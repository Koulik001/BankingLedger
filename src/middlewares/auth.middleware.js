const userModel = require('../models/user.model');
const blacklistModel = require('../models/blacklist.model');
const jwt = require('jsonwebtoken');

async function authUser(req, res, next){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if(!token){
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }
    const isBlacklisted = await blacklistModel.isBlacklisted(token)
    if(isBlacklisted){
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.userId);
        if(!user){
            return res.status(401).json({
                message: "Unauthorized access, user not fount"
            })
        }
        req.user = user;
        return next()
    } catch(err){
        console.log(err);
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
    
}

async function authSystemUser(req, res, next){
    const token = req.cookies.token || req.headers.authorization.split(" ")[1]
    if(!token){
        return res.status(401).json({
            message: "Unauthorized access, token not found"
        })
    }

    const blacklisted = await blacklistModel.isBlacklisted(token)
    if(blacklisted){
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findByIdWithSystemFlag(decoded.userId)
        if(!user){
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        if(!user.is_system_user){
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }
        req.user = user
        return next()
    }catch(err){
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

module.exports = { 
    authUser,
    authSystemUser
 }