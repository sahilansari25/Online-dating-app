const express = require('express');
const Handlebars = require('handlebars');
const {engine} = require('express-handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
//load models
const Message = require('./models/message');
const User = require('./models/user');
const app = express();
//load keys file
const Keys = require('./config/keys');
//use bodyparser
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
//confirguration
app.use(cookieParser());
app.use(session({
    secret: 'mysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
//load facebook strategy
require('./passport/facebook');
//connect to mLab MongoDb
mongoose.connect(Keys.MongoDB,{useNewUrlParser:true}).then(() => {
    console.log('server is connected to MongoDB');
}).catch((err) => {
    console.log(err);
});
// environment var for port
const port = process.env.PORT || 3000;
// setup view engine
app.engine('handlebars',engine({defaultLayout:'main' ,handlebars: allowInsecurePrototypeAccess(Handlebars)}));
app.set('view engine','handlebars');

app.get('/',(req,res) => {
    res.render('home',{
        title: 'Home'
    });
});
app.get('/about',(req,res) => {
    res.render('about',{
        title:'About'
    });
});
app.get('/contacts',(req,res) => {
    res.render('contacts',{
        title: 'Contacts'
    });
});

app.get('/auth/facebook',passport.authenticate('facebook',{
    scope: ['email']
}));
app.get('/auth/facebook/callback',passport.authenticate('facebook',{
    successRedirect: '/profile',
    failureRedirect: '/'
}));
app.post('/contactUS',(req,res) => {
    console.log(req.body);
    const newMessage = {
        fullname: req.body.fullname,
        email: req.body.message,
        date: new Date()
    }
    new Message(newMessage).save((err,message) => {
        if (err) {
            throw err;
        }else{
            Message.find({}).then((messages) => {
                if (messages) {
                    res.render('newmessage', {
                        title: 'Sent',
                        messages:messages
                    });
                }else{
                    res.render('noMessage',{
                        title: 'Not Found'
                    });
                }
            });
        }
    });
});




app.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});