//jshint esversion:6

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

//const encrypt = require('mongoose-encryption');
//const md5 = require('md5');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://127.0.0.1:27017/userDB").then(function () {
    console.log("Connected to database.");
}).catch(function (err) {
    console.log("Failed to connect to database" + err);
});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

//userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password']});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

//passport.serializeUser(User.serializeUser());
//passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));


app.get("/", function (req, res) {
    res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
        res.render('secrets');
    } else {
        res.redirect("/login");
    }
});


app.get("/submit", function(res, req){
    if (req.isAuthenticated()) {
        res.render('submit');
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
    
    User.findById(req.user.id).then(function(foundUser){
        if(foundUser){
            foundUser.secret = submittedSecret;
            foundUser.save();
            res.redirect("/secrets");
        }
    }.catch(function(err){
        console.log(err);
    }));
});

app.get("/logout", function (res, req) {
    req.logout(function (err) {
        if (err) {
            console.log("Cannot logout" + err);
        }
        res.redirect('/');
    });
    res.redirect('/');
});

app.post("/register", function (req, res) {

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect('/secrets');
            })
        }
    });

    // const newUser = new User({
    //     email: req.body.username,
    //     password: md5(req.body.password)
    // });
    // newUser.save().then(function(){
    //     res.render('secrets');
    // }).catch(function(err){
    //     console.log("Cannot register new user" + err);
    // });
});

app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });

    // const userName = req.body.username;
    // const password = md5(req.body.password);

    // User.findOne({email: userName}).then(function(foundUser){
    //     if(foundUser){
    //         if(foundUser.password === password){
    //             res.render("secrets");
    //         }
    //     }
    //     else{

    //     }
    // }).catch(function(err){
    //     console.log("Cannot use find" + err);
    // });
});


app.listen(3000, function () {
    console.log("Active on port 3000");
});