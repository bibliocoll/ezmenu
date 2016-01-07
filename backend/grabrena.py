#!/usr/bin/env python3

'''grabrena.py - grab info from ReNa and make it usable for the menu

a part of EZMenu
@copyright: Copyright 2015 MPI for Research on Collective Goods
@license: AGPLv3+

cron job to keep an EZproxy installation that uses our mmenu based interface
running and up to date. this script attempts to do the following things:
- get updates from the MPDL bzr repository for the MPG-wide eResources file
- append our menu injection stuff to each stanza in that file
- copy the new file into the EZproxy installation
- log into EZproxy with an account set up for that purpose
- get the list of predefined collections set up in ReNa for your institute
- query ReNa for each of these collections through EZProxy, so all URLs that
  can be proxied will be rewritten, check if there have been changes
- only if a collection has changed, save these it as a JSONP response
  where it can be served by the internal webserver of EZProxy
- write a small (JSON) index of the collections and when each was last updated
- log out of EZProxy
'''

# TODO(krugar): the account used to login should only have access to ReNa
# this should be done by setting up groups in config.txt accordingly manually.
# however, adding a check to the script would be good

# TODO(krugar): write a nice error handling routine that catches our
# custom errors and dies gracefully or writes an email if the error is critical

import collections
import configparser
import hashlib
# import io
import json
import os
import re
import requests
import subprocess
# import sys
import time
from urllib.parse import urlparse
from urllib.parse import urlunparse

# example of expected json data format incoming from ReNa:
# getSets({
#   "ERS000000318":{
#     "title":"Collective Goods Research and Explore, CORE",
#     "genre":["MPG Library Catalog","Reference Database","Miscellaneous"],
#     "topic":["Social Sci. + Humanities"],
#     "language":["German","English"],
#     "title_short":"CORE - Collective Goods Research and Explore",
#     "prov_txt_mv":["MPI Collective Goods"],
#     "subject_txt_mv":["Law","Economics","Psychology"],
#     "scope_txtF_mv":["MPG"],
#     "naturl_str_mv":["http://core.coll.mpg.de\/"]
#   },
#   "rinse":{"repeat":"..."}
# });

# we're cutting this open to insert extra fields and put the bulk
# of the ReNa response into a "data" field in our expanded response

# example of json data format written out from this script:
# fromRemote<id>({
#   "name":"Some Collection",
#   "id":"000001234",
#   "timestamp":"seconds_since_epoch",
#   "data":{
#     "ERS000000318":{
#       "as":"above"
#     },
#     "rinse":{"repeat":"..."}
#   }
# });


# ~~~ CLASSES  ~~~
# ~~~ EXCEPTIONS  ~~~
class GrabrenaError(Exception):
    '''app level exception base class'''
    def __init__(self, message):
        self.message = message


class RenaConnectionError(GrabrenaError):
    '''Rena is unreachable'''
    pass


class NoSetlistError(GrabrenaError):
    '''we have no Setlist, neither from ReNa nor local'''
    pass


class LoginError(GrabrenaError):
    '''logging in to EZProxy failed'''
    pass


class NoJsonpError(GrabrenaError):
        '''data expected to be JSONP is malformed'''
        pass


# ~~~ OTHER CLASSES  ~~~
class EZProxyStanza(object):
    def __init__(self, prequel, title, mimefilter, url, other_lines, *script_filename):
        self.prequel = prequel or ''  # optional
        self.title = title
        self.mimefilter = mimefilter or ''  # verrry optional
        self.url = url
        self.stanza = other_lines
        if script_filename is not None:
            self.scriptname = script_filename
        else:
            self.scriptname = None
        self.inj_code_template = ['Find <head', 'Replace -AddState=inHtml+notInScript <head',
                                  'Find <script', 'Replace -RemoveState=notInScript <script',
                                  'Find </script', 'Replace -AddState=notInScript </script',
                                  'Find -State=inHtml+notInScript </head>',
                                  'Replace <script type="text/javascript" src="{0}" defer="defer"></script></head>',
                                  '\n']
        # check whether injection code is present and remove it if it is
        inj_pos = self.stanza.find(self.inj_code_template[0])
        if inj_pos >= 0:
            self.stanza = self.stanza[:inj_pos]
        # TODO(krugar): capture scriptname from present injection code, store in variable
        # and re-add with that if __str__() gets called while self._injection_added = False ?
        self._injection_added = False

    def add_injection(self, sname):
        if sname is None:
            if self.scriptname is not None:
                sname = self.scriptname
            else:
                raise GrabrenaError('EZProxyStanza cannot add injection code without a script name/url')
        # stanza has a closing \n, so join with ''
        self.stanza = ''.join([self.stanza, '\n'.join(self.inj_code_template).format(sname)])
        self._injection_added = True

    def __str__(self):
        if self._injection_added:
            return ''.join([self.prequel,
                            'Title ', self.title, '\n',
                            self.mimefilter,
                            'URL ', self.url, '\n',
                            self.stanza,
                            '\n'])
        else:
            raise GrabrenaError('tried to do str(EZProxyStanza) without adding injection code first')


class ERessourcesFile(object):
    '''provides iterator access to EZProxy database stanzas

as specified in the last 3 lines on
http://www.oclc.org/support/services/ezproxy/documentation/cfg/config-txt-intro.en.html
we're expecting Database Stanzas of the following format:

    Title <Some Title Phrase>
    URL <Something we simply assume is a valid URL>
    <multiple non-empty lines not starting with 'Title' or 'URL'>

our RE parses the portions denoted by <> above into named groups
even if Title and URL appear in reverse order. they need to be the first
two lines of a stanza, however. Case is irrelevant

file/open wrapper code from http://stackoverflow.com/a/14095585
by http://stackoverflow.com/users/4279/j-f-sebastian
'''

    def __init__(self, file, *args, **kwargs):
        self.close_file = kwargs.pop('close', True)
        # accept either filename or file-like object
        self.file = file if hasattr(file, 'read') else open(file, *args, **kwargs)

        # initialize iterator stuff
        r = re.compile(
            ''.join([
                # stanzas usually start with one or more comment lines
                # followed by a limited list of commands that need to go before
                '(?P<prequel_of_stanza>(^(?!((title|url).+?\n|\n))|',
                '(#|option|proxyhostnameedit|mimefilter|neverproxy|',
                'anonymousurl|httpheader|cookie).+?\n)*?)',
                # the required title and url lines, which can come in reverse
                '(',
                '(^title (?P<title>.+?)$\n',
                # also, the MPDL likes to put mimefilter directly behind title
                '(?P<misplaced_mimefilter>^mimefilter.+?$\n)?',
                '^url (?P<url>.+?)$\n)',
                '|',  # check for the the reverse case
                '(^url (?P<url2>.+?)$\n',
                '(?P<misplaced_mimefilter2>^mimefilter.+?$\n)?',
                '^title (?P<title2>.+?)$\n)',
                ')',
                # the rest of the stanza is not properly defined here
                # aside from the requirement that it cannot run over
                # the next Title or URL line
                '(?P<rest_of_stanza>(^(?!title|url).+?\n)*)',
                # we cling to the hope that it is terminated by an empty line.
                # this is convention only, tho :S
                # however, since the sequence of stanzas is preserved,
                # there is a certain chance that parsing errors will be of
                # limited consequence. (probably menu injection will fail)
                '(?:\n*)']),
            re.MULTILINE | re.IGNORECASE)
        self._iterator = r.finditer(self.file.read())  # iterate over RE matches

    # context manager support
    def __enter__(self):
        return self

    def __exit__(self, *args, **kwargs):
        if not self.close_file:
            return  # do nothing
        # clean up
        exit = getattr(self.file, '__exit__', None)
        if exit is not None:
            return exit(*args, **kwargs)
        else:
            exit = getattr(self.file, 'close', None)
            if exit is not None:
                exit()

    # iterator support
    def __iter__(self):
        return self

    def __next__(self):
        m = self._iterator.__next__()
        # .strip() to remove trailing whitespace for fields w/o newline
        this_prequel = m.group('prequel_of_stanza')
        this_title = m.group('title').strip() or m.group('title2').strip()
        this_mimefilter = m.group('misplaced_mimefilter') or m.group('misplaced_mimefilter2')
        this_url = m.group('url').strip() or m.group('url2').strip()
        this_stanza = m.group('rest_of_stanza')
        return EZProxyStanza(this_prequel, this_title, this_mimefilter, this_url, this_stanza, None)

    next = __next__  # Python 2 support

    # delegate everything else to file object
    def __getattr__(self, attr):
        return getattr(self.file, attr)


# ~~~ FUNCTIONS ~~~
def jsonp_to_json(data, fn_name=None):
    '''extract json object from jsonp string, using OrderedDict for object pairs'''
    if data[-2:] != ');':
        raise NoJsonpError('JSONP string did not end with ");"')
    if fn_name is None:
        try:
            fn_open = data.index('(')
            p = re.compile('\w+')
            if p.match(data[:fn_open]):
                return json.loads(data[fn_open+1:-2], object_pairs_hook=collections.OrderedDict)
            else:
                raise NoJsonpError(''.join(['JSONP string started with fishy function name: "',
                                            data[:fn_open], '")']))
        except ValueError:
            raise NoJsonpError('JSONP string did not start with function name and opening bracket')
    else:
        if data[:len(fn_name)+1] == ''.join([fn_name, '(']):
            return json.loads(data[len(fn_name)+1:-2], object_pairs_hook=collections.OrderedDict)
        else:
            raise NoJsonpError(''.join(['JSONP string did not start with provided function name ("',
                                        fn_name, '")']))


def json_hexdigest(data):
    '''creates a sha1 hash of the json representation of an object'''
    newsha = hashlib.sha1()
    # TODO(krugar): find a way to do this without the extra encode('utf-8')
    newsha.update(json.dumps(data).encode('utf-8'))
    return newsha.hexdigest()


def good_rena_entries_to_array(entries):
    '''copy good items from ReNa JSON response obj into array, discard dict keys'''
    # TODO(krugar): more data integrity checks -> OWASP json sanitizer?
    total_urls = 0
    proxied_urls = 0
    ret_arr = []  # array to preserve ordering on js side
    for rena_entry in list(entries.values()):
        if 'title' not in rena_entry or 'access_txtF' not in rena_entry:
            continue
        if ('naturl_str_mv' not in rena_entry or rena_entry['naturl_str_mv'][0] is None):
            continue
        list_item = collections.OrderedDict()
        tmp = rena_entry['title']
        list_item['title'] = tmp if isinstance(tmp, str) else tmp[0]
        tmp = rena_entry['naturl_str_mv'][0]
        list_item['url'] = tmp if isinstance(tmp, str) else tmp[0]
        list_item['proxied'] = grcfg['proxy_hostname'] in list_item['url']
        list_item['free'] = rena_entry['access_txtF'] == 'FREE'
        if 'description' in rena_entry:
            list_item['desc'] = rena_entry['description']

        # NOTE: this is the place where you can ferry more ReNa data over to the javascript side
        # common fields you could use:
        # 'title': 'some string, name we use in the menu'
        # 'naturl_str_mv': ['URL leading this resource', ...]  # NOTE: array field with usually just one entry
        # 'genre' -> ['Journal Collection', ...]
        # 'topic' -> ['Social Sci. + Humanities', ...]
        # 'language' -> ['German', ...]
        # 'title_short' -> 'some string, name in ReNa'
        # 'prov_txt_mv' -> ['name of provider']
        # 'subject_txt_mv' -> ['Economics', ...]
        # 'rank_str_mv' -> ['array', 'of', 'institute', 'handles']  # MBRG in our case ;)

        total_urls += 1
        if list_item['proxied']:
            proxied_urls += 1
        if not list_item['proxied'] and not list_item['free']:
            print(''.join(['\tALERT: "', str(list_item['title']), '" is not proxied and not free']))
        ret_arr.append(list_item)
    print(''.join(['\tURLs in this Collection: ', str(total_urls), ', thereof proxied: ', str(proxied_urls)]))
    return ret_arr


# ~~~ CONFIG HANDLING ~~~
OUT_FNNAME = 'fromRemote'
OUT2_FNNAME = 'getSets'
PROTO_HTTP = 'http://'
PROTO_HTTPS = 'https://'

configfile = 'grabrena.ini'
defaultconfig = {
    'institute': 'MBRG',
    'proxy_hostname': 'go.coll.mpg.de',
    'proxy_login_port': '',
    'js_outdir': '../src/js/loggedin/',
    'injection_url': 'https://go.coll.mpg.de/loggedin/injectmenu.js',
    'username': 'grabrena',
    'password': '12345',
    'use_https': 'Yes',
    'svn_up_path': '~/ez_mpdl/trunk/config/eResources.txt',
    'eres_path': '/usr/local/ezproxy/config/eResources.txt',
    'svn_opt_cfgdir': '',
    'force_eRes_update': 'No',
    'ezproxy_executable': '/usr/local/ezproxy/ezproxy',
    'cookie_name': 'ezproxy'
}
config = configparser.ConfigParser()
config['DEFAULT'] = defaultconfig
config['grabrena'] = {}
try:
    with open(configfile, 'r') as confh:
        config.readfp(confh)
except OSError:
    print(''.join(['No config file found (at ',
                   configfile,
                   '), creating one with default values']))
    with open(configfile, 'w') as confh:
        config.write(confh)
        confh.write(
            '\n'.join([
                '## you can copy from the DEFAULT section above & set your own values',
                '# proxy_hostname: hostname of your EZProxy installation',
                '# proxy_login_port: in case you run a virtual port setup, where to connect to from localhost',
                '# use_https: whether to connect to your EZProxy via HTTPS ("yes"/"no" works)',
                '# username: credentials this script uses to log into your ezproxy installation',
                '# password: as above',
                '#',
                '# institute: your MPIs shorthand as used on https://rena.mpdl.mpg.de/rena/Ext/PredefinedSets',
                '# js_outdir: where to put json files with menu data',
                '#',
                '# svn_up_path: (optional) path to the eResources.txt file in your local TravelMagic svn repo.',
                '#              If set, we will call "svn up" on it to check for updates from TravelMagic.',
                '#              You can use this and force_eRes_update below to transform your eRes file',
                '#              even if it is not in an svn repository (svn errors will not terminate the script)',
                '# svn_opt_cfgdir: (optional) path to a svn config dir (passed into svn via --config-dir)',
                '# eres_path: (required if svn_up_path is set) where to put a new eResources.txt if there were updates',
                '# force_eRes_update: you can set this to Yes to force copying of eResources.txt',
                '# ezproxy_executable: (optional) your ezproxy executable with path, used to call "ezproxy restart"',
                '# cookie_name: name of the cookie your ezproxy sets for authentication',
                '']))
    raise GrabrenaError('No config found, please edit the file we created for you')
grcfg = config['grabrena']
if grcfg['proxy_login_port'] is not '' and ':' not in grcfg['proxy_login_port']:
    grcfg['proxy_login_port'] = ''.join([':', str(grcfg['proxy_login_port'])])
if grcfg.getboolean('use_https'):
    RENA_URL = 'https://rena-mpdl-mpg-de.{0}{1}/rena/'.format(grcfg['proxy_hostname'], grcfg['proxy_login_port'])
    PROTO = PROTO_HTTPS
else:
    RENA_URL = 'http://rena.mpdl.mpg.de.{0}{1}/rena/'.format(grcfg['proxy_hostname'], grcfg['proxy_login_port'])
    PROTO = PROTO_HTTP
FULLCATALOG_ITEM = {
    'id': 'Everything',
    'name': 'Everything',
    'url': ''.join([RENA_URL, 'Search/Results?lookfor=&type=AllFields']),
    'logo': 'two'
}

# ~~~ IF CONFIGURED, CHECK TRAVELMAGIC SVN REPO FOR UPDATES ~~~
if grcfg['svn_up_path'] is not None and grcfg['svn_up_path'] is not '':
    got_svn_update = False
    try:
        print('Running Subversion on configured repository directory...')
        print(''.join(['--- output from running "svn up ', grcfg['svn_up_path'], '" ---']))
        if grcfg['svn_opt_cfgdir'] is None or grcfg['svn_opt_cfgdir'] == '':
            svn_command = ['svn', 'up',
                           grcfg['svn_up_path']]
        else:
            svn_command = ['svn', 'up',
                           '--config-dir', grcfg['svn_opt_cfgdir'],
                           grcfg['svn_up_path']]
        svn_output = subprocess.check_output(' '.join(svn_command), shell=True, universal_newlines=True)
        print(svn_output)
        print('--- end subprocess output ---')
        if 'Updated to revision' in svn_output:
            print('Checked TravelMagic repository, and we got new data!')
            got_svn_update = True
        elif 'At revision' in svn_output:
            print('Checked TravelMagic repository, no new data')
        else:
            print('WARNING: Checked TravelMagic repository, but something seems off. Please check output above')
    except subprocess.CalledProcessError as e:
        print(e.output)
        print('--- end subprocess output ---')
        print('ERROR: Subversion exited with non-zero status code. Something went wrong!')
        if e.returncode == 127:
            print('\tPlease make sure that you have Subversion installed.')
            print('\tUnder Debian/Ubuntu linux, you can install it with "sudo apt-get install svn"')
        elif e.returncode == 1:
            print('\tPlease check your configuration, maybe you need to adjust "svn_up_path" in the ini file?')
        print('(Ignore this if you\'re just using grabrena.py to add Find/Replace codes to a non-repo file)')

    # ~~~ COPY SUBVERSION DATA TO EZPROXY INSTALLATION, ADD OUR JAVASCRIPT INJECTION CODE ~~~
    if got_svn_update or grcfg.getboolean('force_eRes_update'):
        try:
            inj_url = grcfg['injection_url']
            with ERessourcesFile(grcfg['svn_up_path'], 'r') as repofile, open(grcfg['eres_path'], 'w') as configfile:
                for stanza in repofile:
                    stanza.add_injection(inj_url)
                    configfile.write(str(stanza))
            print('Updated eResources.txt, EZPROXY RESTART REQUIRED!')
            # TODO(krugar): send email to admin and quit if no executable configured
            if grcfg['ezproxy_executable'] is not None and grcfg['ezproxy_executable'] is not '':
                print('Restarting EZProxy with new configuration')
                print(''.join(['--- output from running "', grcfg['ezproxy_executable'], ' restart" ---']))
                restart_command = [grcfg['ezproxy_executable'], 'restart']
                restart_output = subprocess.check_output(' '.join(restart_command), shell=True, universal_newlines=True)
                print(restart_output)
                print('--- end subprocess output ---')
                print('sleeping for 10 seconds to allow EZProxy to start up...')
                # TODO(krugar): check if presence of the charge process in pidfile is sufficient for continuation
                time.sleep(10)
                print('...continuing')
        except Exception as e:
            print(e.output)


# ~~~ COMPOSE MENU FROM PROXIED RENA DATA ~~~
with requests.Session() as s:
    # ~~~ LOG IN TO EZPROXY ~~~
    creds = {'user': grcfg['username'], 'pass': grcfg['password'], 'url': '^U'}
    login_url = ''.join([PROTO, grcfg['proxy_hostname'], grcfg['proxy_login_port'], '/login'])
    r0 = s.post(login_url, data=creds, allow_redirects=False)
    if (r0.status_code == 302) and (s.cookies is not None) and (grcfg['cookie_name'] in s.cookies.keys()):
        print(''.join(['Logged in to EZProxy "', grcfg['proxy_hostname'], '" as user "', grcfg['username'], '"']))
        # print(r0.status_code, s.cookies.keys(), r0.headers)
    else:
        raise LoginError(''.join(['Failed to log in, received no session cookie. HTTP Status: ', str(r0.status_code)]))

    # alright, we logged in. make sure we log out again, no matter what goes wrong
    try:
        # ~~~ GRAB THE LIST OF COLLECTIONS FROM RENA (PredefinedSets)~~~
        paramlist = {'inst': grcfg['institute']}
        need_to_write_setlist = False
        rena_setdict = collections.OrderedDict()
        old_setdict = collections.OrderedDict()
        old_setlist = []
        print('Requesting Collection List from ReNa...')
        try:
            r1 = s.get(
                ''.join([RENA_URL, 'Ext/PredefinedSets']),
                params=paramlist
            )
            r1.raise_for_status()
            # create a dict so we have IDs to iterate over
            # exptected data format from ReNa is array of objects
            # with fields as follows:
            # id: 'unique 9-digit number as string'
            # name: 'given name of the collection'
            # fullName: '<institute shorthand>: <given name of the collection>'
            # url: 'query url to get this collection from ReNa, w/o view param'
            for setitem in r1.json():
                if grcfg['proxy_login_port'] is not None and grcfg['proxy_login_port'] is not '':
                    urllist = list(urlparse(setitem['url']))
                    if ':' in urllist[1]:
                        urllist[1] = ''.join([urllist[1][:urllist[1].find(':')],
                                              grcfg['proxy_login_port']])
                    else:
                        urllist[1] = ''.join([urllist[1], grcfg['proxy_login_port']])
                    setitem['url'] = urlunparse(urllist)
                rena_setdict[setitem['id']] = {
                    'id': setitem['id'],
                    'url': setitem['url'],
                    'name': setitem['name'],
                    'logo': 'one'
                }
            if len(rena_setdict) == 0:
                raise NoSetlistError('Got empty collection list from Rena.'
                                     ' Have you configured your institute name in grabrena.ini? Aborting')
            print(''.join(['\tGot fresh data, list has ', str(len(rena_setdict)), ' entries']))

            # add the "Everything" collection, as this is not part of the PredefinedSets
            rena_setdict[FULLCATALOG_ITEM['id']] = FULLCATALOG_ITEM

        except requests.exceptions.RequestException as e:
            print('\tOops, network error: ', e.args)
            print('\ttrying to work with on-disk list...')
        try:
            with open(''.join([grcfg['js_outdir'], 'setlist.json']), 'r') as setfile:
                old_setlist = json.load(setfile, object_pairs_hook=collections.OrderedDict)
                for setitem in old_setlist:
                    old_setdict[setitem['id']] = setitem
            print('\tOld setlist file present')
            # if grabbing the collection list from rena failed, we can try to use the local one
            if len(rena_setdict) == 0:
                rena_setdict = old_setdict
                print(''.join(['\tGoing to try and get collection data for on-disk list (',
                               str(len(rena_setdict)), ' entries)']))
        except OSError:
            print('\tOld setlist file not found, starting from scratch')
            need_to_write_setlist = True
            if len(rena_setdict) == 0:
                raise NoSetlistError('Connection to ReNa failed & no local setlist.json file. Aborting')
        except NoJsonpError:
            print('\tOld setlist file faulty, starting from scratch')
            need_to_write_setlist = True
            if len(rena_setdict) == 0:
                raise NoSetlistError('Connection to ReNa failed & local setlist.json file faulty. Aborting')

        # ~~~ GET EACH COLLECTION FROM RENA ~~~
        if len(rena_setdict) > len(old_setdict):
            print('\tThe list we got from ReNa has new collections')
            need_to_write_setlist = True
        elif len(rena_setdict) < len(old_setdict):
            print('\tThe fresh list we got from ReNa has fewer collections than the one we had on disk. Purging files')
            need_to_write_setlist = True
            for old_id in old_setdict.keys():
                if old_id not in rena_setdict.keys():
                    os.remove(''.join([grcfg['js_outdir'], old_id, '.json']))
        for set_id, renaset in rena_setdict.items():
            print(''.join(['Requesting Data for Collection "', renaset['name'], '"...']))
            old_json = None
            old_digest = None
            try:  # check local file for this collection
                with open(''.join([grcfg['js_outdir'], set_id, '.json']), 'r') as old_file:
                    old_json = json.load(old_file, object_pairs_hook=collections.OrderedDict)
                # only hash over the data originally retrieved from ReNa, not the metadata
                old_digest = json_hexdigest(old_json['data'])
            except OSError:
                print("\tWe don't have a local copy of this one yet")

            # query ReNa for this collection
            r2 = s.get(renaset['url'], params={'view': 'JSONP', 'callback': ''.join([OUT_FNNAME, set_id])})
            r2.raise_for_status()
            newdata_json = jsonp_to_json(r2.text, ''.join([OUT_FNNAME, set_id]))
            timestamp = str(int(time.time()))
            data_list = good_rena_entries_to_array(newdata_json)
            new_digest = json_hexdigest(data_list)
            new_data = collections.OrderedDict()
            new_data['name'] = renaset['name']
            new_data['id'] = set_id
            new_data['data'] = data_list

            # update/create local file for this collection
            if old_digest != new_digest:
                need_to_write_setlist = True
                if old_digest is not None:
                    print('\tData from ReNa differs from local copy, updating')
                with open(''.join([grcfg['js_outdir'], set_id, '.json']), 'w') as out:
                    json.dump(new_data, out)
                if set_id in rena_setdict:
                    # this was an update to a collection we knew about
                    rena_setdict[set_id]['timestamp'] = timestamp
                else:
                    # this was a new collection, remember new timestamp
                    rena_setdict[set_id] = {
                        'id': set_id,
                        'timestamp': timestamp,
                        'name': renaset['name']
                    }
            elif old_digest is not None and old_setdict[set_id] is not None:
                # no difference in digests, collection hasn't changed
                # keep the old metadata/timestamp
                print('\tLocal data is still good')
                rena_setdict[set_id] = old_setdict[set_id]
            else:
                need_to_write_setlist = True  # just making sure
        if need_to_write_setlist:
            # only write this file when there were changes to minimize cache invalidations
            # write out an array of values, the keys are only useful while we work on the data here
            for setlist_item in rena_setdict.values():
                if 'url' in setlist_item:
                    del setlist_item['url']
            with open(''.join([grcfg['js_outdir'], 'setlist.json']), 'w') as out2:
                json.dump(list(rena_setdict.values()), out2)

    finally:  # be a good user and log out of EZProxy no matter what
        # ~~~ LOG OUT OF EZPROXY ~~~
        # TODO(krugar): handle all possibly raised errors gracefully
        r3 = s.get(''.join([PROTO, grcfg['proxy_hostname'], grcfg['proxy_login_port'], '/logout']))
        r3.raise_for_status()
        print(''.join(['Logged out from "', grcfg['proxy_hostname'], '"']))
