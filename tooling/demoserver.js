var server=require('node-http-server');
server.deploy(
    {
        port:8000,
        root: __dirname + '/../demo/'
    }
);
console.log('Demo Server running at http://localhost:8000')
