const { firebase, admin } = require('../../firebase/fbConfig');
const DB_Utils = require('../DB/utils')
const User = require('./User')
const Utils = require('../Utils')

const COLLECTION_USERS_DETAILS = 'usersDetails';


async function registerUser(data) {
    let newUser = null;
    try {
        await firebase
            .auth()
            .createUserWithEmailAndPassword(data.email, data.password)
            .then((user) => {
                let registeredUser = user.user
                data.uid = registeredUser.uid
                newUser = new User(data)
            }).catch((error) => {
                throw error
            })
    } catch (error) {
        throw error
    }
    return newUser
}

async function wriewUserDetails(user) {
    let success = false
    try {
        success = await DB_Utils.writeToCollection(COLLECTION_USERS_DETAILS, user.uid, user.data)
    } catch (error) {
        deleteUser()
        throw Utils.createError(`couldent write data to ${user.email}\n${error}`)
    }
    return success
}

async function getToken() {
    let token = null;
    try {
        await firebase
            .auth()
            .currentUser
            .getIdToken(true)
            .then((idToken) => {
                token = idToken
            }).catch((error) => {
                throw Utils.createError(`Error getting token ${newUser.email}, ${error}`)
            });
    } catch (error) {
        throw error
    }
    return token
}

async function login(email, password) {
    let token = null;
    let user = null;
    try {
        await firebase
            .auth()
            .signInWithEmailAndPassword(email, password)
            .then(async (registeredUser) => {
                await registeredUser.user.getIdToken(true)
                    .then(async (idToken) => {
                        token = idToken
                        user = await getUser(registeredUser.user.uid)
                    }).catch((error) => {
                        throw error
                    });
            }).catch((error) => {
                throw error
            });
    } catch (error) {
        throw error
    }
    return {
        user: user,
        token: token
    }
}

async function logout() {
    let success = false
    try {
        await firebase
            .auth()
            .signOut()
            .then(() => {
                success = true
            }).catch((error) => {
                throw error
            });
    } catch (error) {
        throw error
    }
    return success
}

async function updateProfile(data) {
    let success = false;
    try {
        let user = await firebase.auth().currentUser;
        if (user) {
            await DB_Utils.updateDocument(COLLECTION_USERS_DETAILS, user.uid, data)
                .then((resault) => {
                    if (resault) success = true
                }).catch((error) => {
                    throw error
                })
        }
        else {
            throw Utils.createError('User is not signed in!')
        }
    } catch (error) {
        throw error
    }
    return success
}

async function getUser(userId) {
    let user = null;
    await DB_Utils.getDocument(COLLECTION_USERS_DETAILS, userId)
        .then((found) => {
            if (found) {
                user = new User(found)
            } else {
                throw Utils.createError(`No user details document found for ${userId}`)
            }
        })
    return user
}

async function getAllUsers() {
    let users = null
    await admin
        .auth()
        .listUsers()
        .then((res) => {
            users = res
        }).catch((error) => { throw error });
    return users
}

async function getAllUsersDetails() {
    let users = null;
    await DB_Utils.getCollection(COLLECTION_USERS_DETAILS)
        .then((found) => {
            if (found) {
                users = found
            } else {
                users = []
            }
        })
    return users
}

async function addGroup(userId, groupId) {
    let user = null
    try {
        user = await getUser(userId)
        user.addToGroupsList(groupId)
        let updateUser = await updateProfile({ groups: user.groups })
    } catch (error) {
        throw error
    }
    return user
}

async function resetPassword(email) {
    let success = false;
    try {
        firebase
            .auth()
            .sendPasswordResetEmail(email)
            .then(() => {
                success = true
            }).catch((error) => {
                throw error
            });
    } catch (error) {
        throw error
    }
    return success
}

function validateRequest(req, required = [], optional = []) {
    switch (req.url) {
        case '/register':
            required = User.Validators.registerRequest.required
            optional = User.Validators.registerRequest.optional
            break;
        case '/updateProfile':
            required = User.Validators.updateProfileRequest.required
            optional = User.Validators.updateProfileRequest.optional
            break;
        case '/login':
            required = User.Validators.loginRequest.required
            optional = User.Validators.loginRequest.optional
            break;
        default:
            if (required.length == 0 && !optional.length == 0)
                throw Utils.createError(`Can't validate ${req.url}. No validetors provided`)
    }
    return Utils.validateRequest(req, required, optional)
}

function sendVerificationEmail() {
    var user = firebase.auth().currentUser;
    try {
        user.sendEmailVerification()
            .then(() => {
                console.log('Verification email sent to ' + user.email)
            }).catch((error) => {
                throw error
            });
    }
    catch (error) {
        throw error
    }
}

function deleteUser() {
    var user = firebase.auth().currentUser;
    user.delete()
        .then(() => {
            console.log(`User ${user.email} has been deleted successfully`)
        }).catch(() => {
            throw Utils.createError(`Error deleting ${user.email}\n${error}`)
        })
}

module.exports = {
    sendVerificationEmail,
    validateRequest,
    registerUser,
    wriewUserDetails,
    getToken,
    login,
    logout,
    updateProfile,
    getUser,
    getAllUsers,
    getAllUsersDetails,
    addGroup,
    resetPassword
}