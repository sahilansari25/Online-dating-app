const express = require('express');
const {engine} = require('express-handlebars');

const app = express();
// environment var for port
const port = process.env.PORT || 3000;
// setup view engine
app.engine('handlebars',engine({defaultLayout:'main'}));
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
app.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});