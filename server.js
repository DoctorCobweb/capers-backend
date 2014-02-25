// server.js: the node backend for capers web app


// load modules
var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    jade = require('jade'),
    mongoose = require('mongoose'),
    RedisStore = require('connect-redis')(express),
    CLIENT_APP_DIR = 'dist',
    PORT = process.env.PORT || 5000,
    mongo_uri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL ||
        'mongodb://localhost/capersdb';
    


// connect to the mongo db
var capersdbConnection = mongoose.connect(mongo_uri, function (err, res) {
    if (err) {
        console.log('ERROR: could not connect to ' + mongo_uri + '.' + err);
    } else {
        console.log('SUCCESS: connected to ' + mongo_uri);
    }
});



// setup the redis store which is used for session management
if (process.env.REDISTOGO_URL) {
    var rtg = require('url').parse(process.env.REDISTOGO_URL);
    var rClient = require('redis').createClient(rtg.port, rtg.hostname);
    var redisStore = new RedisStore({client: rClient});
} else {
    var redisStore = new RedisStore();
}





// define model schema for collections
var Filter = new mongoose.Schema({
    badTerm:     String,
    goodTerm:    String,
    description: String
});


var AdminUser = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type: String, required: true}
});


var AdminUserModel = capersdbConnection.model('AdminUser', AdminUser);
var FilterModel = capersdbConnection.model('Filter', Filter);


// create express app
var app = express();


app.set('view engine', 'jade'),
app.set('views', applicationRoot + '/views'),
app.set('view options', {layout: false});


// configure the server
app.configure(function () {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.query());
    app.use(express.cookieParser('my secret string'));
    app.use(express.session({
        store: redisStore,
        secret: 'andre redis session secret',
        cookie: {maxAge: 24 * 60 * 60 *1000}
    }));
    app.use(app.router);
    app.use(express.static(path.join(applicationRoot, CLIENT_APP_DIR)));
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});



//configre the http routes
app.post('/sessions', function (req, res) {
    console.log('in POST /sessions and body posted is:');
    console.log(req.body);
    // used to seed the capersdb initially
    /*
    var adminUser = new AdminUserModel({
        username: 'andre',
        password: 'andre'
    });
    adminUser.save(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('SUCCESS: saved andre as AdminUser');
        }
    });
    */

    var query = {username: req.body.username};

    // find the admin user
    AdminUserModel.findOne(query, function (err, adminUser) {
        if (err) {
            console.log('ERROR: when trying to get admin user: ' + req.body.username);
            handleAuthenticationSession(false);
            return res.send('Query error. Tell the programmer to check their logs');
        } else if (!adminUser) {
            console.log('ERROR: no admin user found for: ' + req.body.username);
            handleAuthenticationSession(false);
            return res.send('Failed to login. Check your details');
        } else {
            if (adminUser.password === req.body.password) {
                console.log('SUCCES: good password for: ' + req.body.username);
                handleAuthenticationSession(true);
                //return res.send('Successful login with details: ' 
                //    + JSON.stringify(req.body));
                return res.redirect('/adminConsole');
            } else {
                console.log('ERROR: bad password for: ' + req.body.username);
                handleAuthenticationSession(false);
                return res.send('Failed to login. Check your details.');
            }
        }

     
        function handleAuthenticationSession(success) {
            if (success) {
                req.session.authenticated = true;
                req.session.username = req.body.username;
                console.log('SUCCESSFUL LOGIN. req.session:');
                console.log(req.session);
            } else {
                req.session.authenticated = false;
                console.log('FAILED LOGIN. req.session:');
                console.log(req.session);
            }
        }
    }); 
});




app.get('/adminConsole', loggedInAsAdmin, function (req, res) {
    // used to seed the capersdb initially
    /*
    var filter = new FilterModel({
        badTerm:     'fuck',
        goodTerm:    'ouch',
        description: 'some people are offended when hearing rude words. be polite'
    });
    filter.save(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('SUCCESS: saved new filter');
        }
    });
  
    var filter1 = new FilterModel({
        badTerm:     'shit yeah',
        goodTerm:    'lovely',
        description: 'dont know what to say about this one. horrible stuff.'
    });
    filter1.save(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('SUCCESS: saved new filter1');
        }
    });

    var filter2 = new FilterModel({
        badTerm:     'blah',
        goodTerm:    'okay',
        description: 'blah can make you sound like you are not interested'
    });
    filter2.save(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('SUCCESS: saved new filter2');
        }
    });
    */

    // find all the filter terms
    //filters is an array
    FilterModel.find(function (err, filters) {
        if (!err) {
            console.log('FOUND FILTERS:');
            console.log(filters);
            render(filters);         
        } else {
            console.log('ERROR: COULD NOT FID FILTERS:');
            console.log(err);
        }
    });


    function render (filters) {
        jade.renderFile('./views/adminConsole.jade', {filters: filters}, cb);

        function cb (err, html) {
            if (err) throw err;
            return res.send(html);
        }
    }
});


app.get('/logout', loggedInAsAdmin, function (req, res) {
    req.session = void 0;    
    console.log('LOGGED USER OUT. req.session set to undefined. Check to see:');
    console.log(req.session);

    return res.redirect('/');
});



// start the server
app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
    console.log('Serving client app from: ' + applicationRoot + '/' + CLIENT_APP_DIR);

});





// helper functions

function loggedInAsAdmin (req, res, next) {
    if (!!req.session.authenticated) {
        next();
    } else {
        return res.render('unauthorizedAccess');
    }
}
