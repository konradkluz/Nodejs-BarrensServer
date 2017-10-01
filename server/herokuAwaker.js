const http = require("http");
const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('server.properties');

const startKeepAwakeTask = () => {
    setInterval(() => {
        pingHerokuServer();
        console.log('Awake request sent.');
    }, properties.get('awake_interval'));
};

const pingHerokuServer = () => {
    http.get("http://barrens-server.herokuapp.com/");
};

module.exports = {startKeepAwakeTask};