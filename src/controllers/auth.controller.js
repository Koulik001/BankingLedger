const userModel = require('../models/user.model');
const blacklistModel = require('../models/blacklist.model');
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service');
/**
 * Register a new user
 */
async function registerUserController(req, res){
    const {email, name, password} = req.body;
    const doesExist = await userModel.findByEmail(email);

    if(doesExist){
        return res.status(422).json({
            message: "User already exists",
            status: "failed"
        })
    }

    const newUser = await userModel.createUser({
        email, name, password
    })

    const token = jwt.sign({
       userId: newUser.id,
    }, process.env.JWT_SECRET, {
        expiresIn: "3d"
    });

    res.cookie("token", token);

    res.status(201).send({
        message: "User created successfully", 
        newUser
    })

    await emailService.sendRegistrationMail(newUser.email, newUser.name);
}

/**
 * Log in a registered user
 * Set the token in cookie after credentials check
 */

async function loginUser(req, res){
    const {email, password} = req.body;

    const user = await userModel.findByEmailWithPassword(email);

    if(!user){
        return res.status(401).send({
            message: "Invalid credentials"
        })
    }

    const isValidPassword = await userModel.comparePasswords(password, user.password);

    if(!isValidPassword){
        return res.status(401).send({
            message: "Invalid credentials"
        })
    }

    const token = jwt.sign({
       userId: user.id,
    }, process.env.JWT_SECRET, {
        expiresIn: "3d"
    });

    res.cookie("token", token);

    return res.status(200).json({
        message: "User loggedin successfully", 
        user
    })
}

/**
 * Log out a user
 * Blacklist the token 
 * Clear the cookie
 */

async function logoutUser(req, res){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if(!token){
        return res.status(200).json({
            message: "User logged out successfully"
        })
    }

    await blacklistModel.addTokenBlacklist(token)

    res.clearCookie("token")

    return res.status(200).json({
        message: "User logged out successfully"
    })
}

module.exports = { 
    registerUserController,
    loginUser,
    logoutUser
}