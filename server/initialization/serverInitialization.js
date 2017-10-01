const express = require('express');
// var reactViews = require('express-react-views');
const initializeServer = () =>{
    const app = express();

    app.set('port', (process.env.PORT || 5000));

// views is directory for all template files
//     app.set('views', 'views');
//     app.set('view engine', 'js');
//     app.engine('js', reactViews.createEngine());

    app.get('/', function (req, res) {
        res.send('server is running');
    });

    app.listen(app.get('port'), function () {
        console.log('Node app is running on port', app.get('port'));
    });
};

module.exports = {initializeServer};
