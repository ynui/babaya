const Demographic = require('./Demographic')
const DB_Utils = require('../DB/dbUtils')
const Utils = require('../Utils')
const Translator = require('../Translateor/translator')


const COLLECTION_DEMOGRAPHIC = 'demographics';

async function createDemographic(data, userId) {
    let newDemographic = null
    try {
        Utils.isCallValid(data, Demographic.RequestValidators.create.required, Demographic.RequestValidators.create.optional)
        newDemographic = new Demographic(data)
        await DB_Utils.getDocument(COLLECTION_DEMOGRAPHIC, newDemographic.demographicId)
            .then(async (doc) => {
                if (doc) {
                    newDemographic = new Demographic(doc)
                    newDemographic.addToUsersList(userId)
                    await DB_Utils.updateDocument(COLLECTION_DEMOGRAPHIC, newDemographic.demographicId, newDemographic.data)
                }
                else {
                    newDemographic.addToUsersList(userId)
                    await writeDemographicDetails(newDemographic)
                }
            })
    } catch (error) {
        throw error
    }
    return newDemographic
}

async function createDemographicsOther(data, userId) {
    let demographicsOther = []
    try {
        for (var demo of data) {
            let demoOther = await createDemographic(demo, userId)
            demographicsOther.push(demoOther)
        }
    } catch (error) {
        throw error
    }
    return demographicsOther
}

async function getDemographic(demographicId) {
    let demographic = null;
    await DB_Utils.getDocument(COLLECTION_DEMOGRAPHIC, demographicId)
        .then((found) => {
            if (found) {
                demographic = new Demographic(found)
            } else {
                throw Utils.createError(`No demographic details document found for ${demographicId}`, 'no-demographic-found')
            }
        })
    return demographic
}

async function getAllDemographics() {
    let demographics = null;
    await DB_Utils.getCollection(COLLECTION_DEMOGRAPHIC)
        .then((found) => {
            if (found) {
                demographics = found
            } else {
                demographics = []
            }
        })
    return demographics
}

async function writeDemographicDetails(demographic) {
    let success = false;
    try {
        await DB_Utils.writeToCollection(COLLECTION_DEMOGRAPHIC, demographic.demographicId, demographic.data)
            .then((doc) => {
                success = true
            }).catch((error) => {
                throw error
            })
    } catch (error) {
        throw error
    }
    return success
}

async function addUser(demographicId, userId) {
    let demographic = null
    try {
        demographic = await getDemographic(demographicId)
        if (demographic.users.includes(userId)) throw Utils.createError(`${demographicId} already has user ${userId}`, 'demographic-already-contains-user')
        demographic.addToUsersList(userId)
        let updatedDemographic = await updateDemographic(demographicId, demographic.data)
    } catch (error) {
        throw error
    }
    return demographic
}

async function removeUser(demographicId, userId) {
    let demographic = null
    try {
        demographic = await getDemographic(demographicId)
        demographic.removeFromUsersList(userId)
        let updatedDemographic = await updateDemographic(demographicId, demographic.data)
    } catch (error) {
        throw error
    }
    return demographic
}

async function updateDemographic(demographicId, data) {
    let success = false;
    try {
        await DB_Utils.updateDocument(COLLECTION_DEMOGRAPHIC, demographicId, data)
            .then((resault) => {
                if (resault) success = true
            }).catch((error) => {
                throw error
            })
    } catch (error) {
        throw error
    }
    return success
}

async function deleteDemographic(demographicId) {
    let success = false;
    try {
        await DB_Utils.deleteDocument(COLLECTION_DEMOGRAPHIC, demographicId)
            .then((doc) => {
                success = true
            }).catch((error) => {
                throw error
            })
    } catch (error) {
        throw error
    }
    return success
}

function validateRequest(req, res, next, required = [], optional = []) {
    let originalUrl = Utils.removeTrailingSlash(req.originalUrl)
    let url = req.customURL || Utils.removeTrailingSlash(req.url)
    req.valid = false
    switch (url) {
        case '/create':
            required = Demographic.RequestValidators.create.required
            optional = Demographic.RequestValidators.create.optional
            break;
        case '/update':
            required = Demographic.RequestValidators.update.required
            optional = Demographic.RequestValidators.update.optional
            break;
        default:
            if (required.length == 0 && optional.length == 0) {
                console.warn(`No validators provided for ${originalUrl}`)
            }
            break;
    }
    let validateResault = Utils.validateRequest(req, required, optional);
    if (validateResault.error) return next(validateResault.error)
    else req.valid = validateResault.valid
    return next()
}

async function getReadableDemographic(demographicId, langId = '1') {
    let resault = null
    let readableLanguage = null
    if (demographicId) {
        readableLanguage = Translator.getReadableLanguage(langId)
        langId = langId.toString()
        if (Array.isArray(demographicId))
            resault = await getManyReadableDemographic(demographicId, langId)
        else
            resault = await getSingleReadableDemographic(demographicId, langId)
    }
    else {
        throw Utils.createError(`User do not have demographic information`, 'no-demographic-available')
    }
    return {
        langId: readableLanguage,
        itemId: resault.itemId,
        value: resault.value
    }
}
async function getSingleReadableDemographic(demographicId, langId = '1') {
    let readableDemographic = null;
    if (demographicId) {
        await getDemographic(demographicId)
            .then(async (found) => {
                if (found) {
                    let translatedFields = Translator.getReadableDemographic(found, langId)
                    for (var field in translatedFields.value) {
                        if (!(found[field] === null)) {
                            var item = translatedFields.value[field]
                            found[field] = {
                                itemId: item.itemId,
                                value: item.value
                            }
                        }
                    }
                    readableDemographic = new Demographic(found)
                } else {
                    throw Utils.createError(`No user details document found for ${demographicId}`, 'demographic-not-found')
                }
            })
    } else {
        throw Utils.createError(`No demographic found`, 'demographic-not-found')
    }
    return {
        langId,
        itemId: demographicId,
        value: readableDemographic
    }
}

async function getManyReadableDemographic(demographicsIds, langId = '1') {
    let ids = []
    let resault = []
    try {
        for (var id of demographicsIds) {
            let newDemo = await getReadableDemographic(id, langId)
            resault.push(newDemo.value)
            ids.push(newDemo.itemId)
        }
    } catch (error) {
        throw error
    }
    return {
        langId: langId,
        itemId: ids,
        value: resault
    }
}

// function translateFields(demographic, langId) {
//     let resault = {
//         countryId: Translator.getItem('country', demographic.countryId, langId) || null,
//         countyId: Translator.getItem('county', demographic.countyId, langId) || null,
//         cityId: Translator.getItem('city', demographic.cityId, langId) || null,
//         streetId: Translator.getItem('street', demographic.streetId, langId) || null
//     }
//     return resault
// }

module.exports = {
    createDemographic,
    createDemographicsOther,
    updateDemographic,
    deleteDemographic,
    getDemographic,
    getReadableDemographic,
    getManyReadableDemographic,
    getAllDemographics,
    validateRequest,
    writeDemographicDetails,
    removeUser,
    addUser
}