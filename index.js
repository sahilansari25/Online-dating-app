const express = require('express');
const Handlebars = require('handlebars');
const {engine} = require('express-handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const formidable = require('formidable');

//load models
const Message = require('./models/message');
const User = require('./models/user');
const Chat = require('./models/chat');
const Smile = require('./models/smile');

const app = express();
//load keys file
const Keys = require('./config/keys');
//Load helpers 
const {requireLogin,ensureGuest} = require('./helpers/auth');
const {uploadImage} = require('./helpers/aws');
const {getLastMoment} = require('./helpers/moment');
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
app.use(flash());
app.use((req,res,next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});
// setup xpress static for css,js
app.use(express.static('public'));
//make user global object
app.use((req,res, next) => {
    res.locals.user = req.user || null;
    next();
});
//load facebook strategy
// require('./passport/facebook');
require('./passport/google');
require('./passport/local');

//connect to mLab MongoDb
mongoose.connect(Keys.MongoDB,{useNewUrlParser:true}).then(() => {
    console.log('server is connected to MongoDB');
}).catch((err) => {
    console.log(err);
});
// environment var for port
const port = process.env.PORT || 3000;
// setup view engine
app.engine('handlebars',engine({defaultLayout:'main' ,handlebars: allowInsecurePrototypeAccess(Handlebars),
    helpers: {
        getLastMoment: getLastMoment
    }
}));
app.set('view engine','handlebars');

app.get('/',ensureGuest,(req,res) => {
    res.render('home',{
        title: 'Home'
    });
});
app.get('/about',ensureGuest,(req,res) => {
    res.render('about',{
        title:'About'
    });
});
app.get('/contacts',ensureGuest,(req,res) => {
    res.render('contacts',{
        title: 'Contacts'
    });
});

// app.get('/auth/facebook',passport.authenticate('facebook',{
//     scope: ['email']
// }));
// app.get('/auth/facebook/callback',passport.authenticate('facebook',{
//     successRedirect: '/profile',
//     failureRedirect: '/'
// }));
app.get('/auth/google',passport.authenticate('google',{
    scope: ['profile','email']
}));
app.get('/auth/google/callback',passport.authenticate('google',{
    successRedirect: '/profile',
    failureRedirect: '/'
}));
app.get('/profile',requireLogin,(req,res) => {
    User.findById({_id:req.user._id}).then((user) => {
        if (user) {
            user.online = true;
            user.save((err,user) => {
                if (err) {
                    throw err;
                }else{
                    Smile.findOne({reciever:req.user._id,recieverRecieved:false})
                    .then((newSmile) => {
                       Chat.findOne({$or: [
                           {reciever:req.user._id,recieverRead:false},
                           {sender:req.user._id,senderRead:false}
                       ]})
                       .then((unread) => {
                        res.render('profile', {
                            title: 'Profile',
                            user: user,
                            newSmile:newSmile,
                            unread:unread
                        });
                       })
                    })
                }
            });
        }
    });
});
app.post('/updateProfile',requireLogin,(req,res) => {
    User.findById({_id:req.user._id})
    .then((user) => {
        user.fullname = req.body.fullname;
        user.email = req.body.email;
        user.gender = req.body.gender;
        user.about = req.body.about;
        user.save(() => {
            res.redirect('/profile');
        });
    });
});
app.get('/askToDelete',requireLogin,(req,res) => {
    res.render('askToDelete', {
        title: 'Delete'
    });
});
app.get('/deleteAccount',requireLogin,(req,res) => {
    User.deleteOne({_id:req.user._id})
    .then(() => {
        res.render('accountDeleted',{
            title:'Deleted'
        });
    });
});
app.get('/newAccount',(req,res) => {
    res.render('newAccount', {
        title: 'Sign Up'
    });
});
app.post('/signup',(req,res) => {
    //console.log(req.body);
    let errors = [];

    if(req.body.password !== req.body.password2) {
        errors.push({text: 'Password does Not match'});
    }
    if (req.body.password.length < 5) {
        errors.push({text: 'Password must be atleast 5 characters'});
    }
    if (errors.length > 0) {
        res.render('newAccount', {
            errors: errors,
            title: 'Error',
            fullname: req.body.username,
            email: req.body.email,
            password: req.body.password,
            password2: req.body.password2
        });
    }else{
        User.findOne({email:req.body.email})
        .then((user) => {
            if (user) {
                let errors = [];
                errors.push({text:'Email already exist'});
                res.render('newAccount',{
                    title:'Sign Up',
                    errors:errors
                })
            }else{
                var salt = bcrypt.genSaltSync(10);
                var hash = bcrypt.hashSync(req.body.password, salt);
                const newUser = {
                    fullname: req.body.username,
                    email: req.body.email,
                    password: hash
                }
                new User(newUser).save((err,user) =>{
                    if (err) {
                        throw err;
                    }
                    if (user) {
                        let success = [];
                        success.push({text:'You have successfully created account.You can login now'});
                        res.render('home', {
                            success: success
                        });
                    }
                });
            }
        });
    }
});
app.post('/login',passport.authenticate('local',{
    successRedirect: '/profile',
    failureRedirect: '/loginErrors'
}));

app.get('/loginErrors', (req,res) => {
    let errors = [];
    errors.push({text: 'User Not found or Password Incorrect'});
        res.render('home',{
            errors:errors
        });
});
//retreive password
app.get('/retrievePwd',(req,res) => {
    res.render('retrievePwd',{
        title:'Retrieve'
    })
})
app.post('/retrievePwd',(req,res) => {
    let email = req.body.email.trim();
    let pwd1 = req.body.password.trim();
    let pwd2 = req.body.password2.trim();

    if(pwd1 !== pwd2) {
        res.render('pwdDoesNotMatch',{
            title:'Not match'
        })
    }

    User.findOne({email:email})
    .then((user) => {
        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(pwd1,salt);

        user.password = hash;
        user.save((err,user) => {
            if (err) {
                throw err;
            }
            if (user) {
                res.render('pwdUpdated',{
                    title:'Updated'
                })
            }
        })
    })
})
//handleget route
app.get('/uploadImage',requireLogin,(req,res) => {
    res.render('uploadImage',{
        title: 'Upload'
    });
});
app.post('/uploadAvatar',requireLogin,(req,res) => {
    User.findById({_id:req.user._id})
    .then((user) => {
        user.image = req.body.upload;
        user.save((err) => {
            if (err) {
                throw err;
            }
            else{
                res.redirect('/profile');
            }
        });
    });
});
app.post('/uploadFile',requireLogin,uploadImage.any(),(req,res) =>{
    const form = new formidable.IncomingForm();
    form.on('file',(field,file) => {
        console.log(file);
    });
    form.on('error',(err) => {
        console.log(err);
    });
    form.on('end',() => {
        console.log('Image Successfully uploaded..');
    });
    form.parse(req);
});
//handle get routes for users
app.get('/singles',requireLogin,(req,res) => {
    User.find({})
    .sort({date:'desc'})
    .then((singles) => {
        res.render('singles',{
            title: 'Singles',
            singles:singles
        })
    }).catch((err) => {
        console.log(err);
    });
});
app.get('/userProfile/:id',(req,res) => {
    User.findById({_id:req.params.id})
    .then((user) => {
        Smile.findOne({reciever:req.params.id})
        .then((smile) => {
            res.render('userProfile',{
                title:'Profile',
                oneUser: user,
                smile:smile
            });
        })
    });
});
//Start Chat
app.get('/startChat/:id',requireLogin,(req,res) => {
    Chat.findOne({sender:req.params.id,reciever:req.user._id})
    .then((chat) => {
        if (chat) {
            chat.recieverRead = true;
            chat.senderRead = false;
            chat.date = new Date();
            chat.save((err,chat) => {
                if (err) {
                    throw err;
                }
                if (chat) {
                    res.redirect(`/chat/${chat._id}`);
                }
            })
        }else{
            Chat.findOne({sender:req.user._id,reciever:req.params.id})
            .then((chat) => {
                if (chat){
                    chat.senderRead = true;
                    chat.recieverRead = false;
                    chat.date = new Date();
                    chat.save((err,chat) => {
                        if (err) {
                            throw err;
                        }
                        if (chat) {
                            res.redirect(`/chat/${chat._id}`);
                        }
                    })
                }else {
                    const newChat = {
                        sender: req.user._id,
                        reciever: req.params.id,
                        senderRead: true,
                        recieverRead: false,
                        date: new Date()
                    }
                    new Chat(newChat).save((err,chat) => {
                        if (err) {
                            throw err;
                        }
                        if (chat) {
                            res.redirect(`/chat/${chat._id}`);
                        }
                    })
                }
            })
        }
    })
})
// Display Chat Room
app.get('/chat/:id',requireLogin,(req,res) => {
    Chat.findById({_id:req.params.id})
    .populate('sender')
    .populate('reciever')
    .populate('chats.senderName')
    .populate('chats.recieverName')
    .then((chat) => {
        User.findOne({_id:req.user._id})
        .then((user) => {
            res.render('chatRoom',{
                title: 'Chat',
                user:user,
                chat:chat
            })
        })
    })
})
app.post('/chat/:id', requireLogin,(req,res) => {
    Chat.findOne({_id:req.params.id,sender:req.user._id})
    .sort({date: 'desc'})
    .populate('sender')
    .populate('reciever')
    .populate('chats.senderName')
    .populate('chats.recieverName')
    .then((chat) => {
        if (chat) {
            //sender sends message here
            chat.senderRead = true;
            chat.recieverRead = false;
            chat.date = new Date();

            const newChat = {
                senderName: req.user._id,
                senderRead: true,
                recieverName: chat.reciever._id,
                recieverRead: false,
                date: new Date(),
                senderMessage: req.body.chat
            }
            chat.chats.push(newChat)
            chat.save((err,chat) => {
                if (err) {
                    throw err;
                }
                if (chat) {
                    Chat.findOne({_id:chat._id})
                    .sort({date:'desc'})
                    .populate('sender')
                    .populate('reciever')
                    .populate('chats.senderName')
                    .populate('chats.recieverName')
                    .then((chat) => {
                        User.findById({_id:req.user._id})
                        .then((user) => {
                            //we will charge client for each message
                            user.wallet = user.wallet - 1;
                            user.save((err,user) => {
                                if (err) {
                                    throw err;
                                }
                                if (user) {
                                        res.render('chatRoom', {
                                            title: 'Chat',
                                            chat:chat,
                                            user:user
                                        })
                                }
                            })
                        })
                    })
                }
            })
        } 
        //reciever sends message here
        else{
            Chat.findOne({_id:req.params.id,reciever:req.user._id })
            .sort({date: 'desc'})
            .populate('sender')
            .populate('reciever')
            .populate('chats.senderName')
            .populate('chats.recieverName')
            .then((chat) => {
                chat.senderRead = true;
                chat.recieverRead = false;
                chat.date = new Date();
                const newChat = {
                    senderName: chat.sender._id,
                    senderRead: false,
                    recieverName: req.user._id,
                    recieverRead: true,
                    recieverMessage: req.body.chat,
                    date: new Date()
                }
                chat.chats.push(newChat)
                chat.save((err,chat) => {
                    if (err) {
                        throw err;
                    }
                    if (chat) {
                        Chat.findOne({_id:chat._id})
                        .sort({date: 'desc'})
                        .populate('sender')
                        .populate('reciever')
                        .populate('chats.senderName')
                        .populate('chats.recieverName')
                        .then((chat) => {
                            User.findById({_id:req.user._id})
                            .then((user) => {
                                user.wallet = user.wallet -1;
                                user.save((err,user) => {
                                    if (err) {
                                        throw err;
                                    }
                                    if (user) {
                                        res.render('chatRoom', {
                                            title: 'Chat',
                                            user: user,
                                            chat:chat
                                        })
                                    }
                                })
                            })
                        })
                    }
                })
            })
        }
    })
})
app.get('/chats',requireLogin,(req,res) => {
    Chat.find({reciever:req.user._id})
    .populate('sender')
    .populate('reciever')
    .populate('chats.senderName')
    .populate('.chats.recieverName')
    .sort({date:'desc'})
    .then((recieved) => {
        Chat.find({sender:req.user._id})
        .populate('sender')
        .populate('reciever')
        .populate('chats.senderName')
        .populate('.chats.recieverName')
        .sort({date:'desc'})
        .then((sent) => {
            res.render('chat/chats',{
                title:'Chat History',
                recieved:recieved,
                sent:sent
            })
        })
    })
})
//delete chat
app.get('/deleteChat/:id',requireLogin,(req,res)=> {
    Chat.deleteOne({_id:req.params._id})
    .then(() => {
        res.redirect('/chats');
    });
});

//get route to send smile
app.get('/sendSmile/:id',requireLogin,(req,res) => {
    const newSmile = {
        sender: req.user._id,
        reciever: req.params.id,
        senderSent: true
    }
    new Smile(newSmile).save((err,smile) => {
        if (err) {
            throw err;
        }
        if (smile) {
        res.redirect(`/userProfile/${req.params.id}`);
        }
    })
})
//Delete Smile
app.get('/deleteSmile/:id',requireLogin,(req,res) => {
    Smile.deleteOne({reciever:req.params.id,sender:req.user._id})
    .then(() => {
        res.redirect(`/userProfile/${req.params.id}`);
    })
})
//show smile sender
app.get('/showSmile/:id',requireLogin,(req,res) => {
    Smile.findOne({_id:req.params.id})
    .populate('sender')
    .populate('reciever')
    .then((smile) => {
        smile.recieverRecieved = true;
        smile.save((err,smile) => {
            if (err) {
                throw err;
            }
            if (smile) {
                res.render('smile/showSmile', {
                    title: 'NewSmile',
                    smile:smile
                })
            }
        })
    })
})

app.get('/logout',(req,res) => {
    User.findById({_id:req.user._id})
    .then((user) => {
        user.online =  false;
        user.save((err,user) => {
            if (err) {
                throw err;
            }
            if (user) {
                req.logout();
                res.redirect('/');
            }
        });
    });
});
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