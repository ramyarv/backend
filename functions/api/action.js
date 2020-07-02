const constants = require('../common/constants')
const validate = require('../common/validator')
const logger = require('../middleware/logger');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const { data } = require('../middleware/logger');
const router = express.Router();
const db = admin.firestore();

/**
 * Route to perform addProduct transaction
 * @returns 201 Created
 */
router.post('/addProduct', async (request, response, next) => {
    logger.info(`Adding product to inventory....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ADD_PRODUCT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()

    const transactionId = await module.exports.createTransaction(data)
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Route to perform issueProduct transaction
 * @returns 201 Created
 */
router.post('/issueProduct', async (request, response, next) => {
    logger.info(`Issuing product from the inventory....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ISSUE_PRODUCT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()

    const transactionId = await module.exports.createTransaction(data)
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Route to perform adjustment transaction
 * @returns 201 Created
 */
router.post('/adjustment', async (request, response, next) => {
    logger.info(`Adjusting product value in the inventory....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ADJUSTMENT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()

    const transactionId = await module.exports.createTransaction(data)
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Validates the request body.
 * @param {*} body request body
 * @param {*} type identifier to determine which request is to be validated
 */
function validateParams(body) {

    let schema = joi.object({
        branch: joi.string()
            .min(1)
            .max(30)
            .required(),
        product: joi.string()
            .min(1)
            .max(30)
            .required(),
        operationalQuantity: joi.number()
                    .required()
    })
    return validate(schema, body)
}

module.exports = router;

/**
 * Method to create a new transaction
 * @param {data for the transaction} data
 */
module.exports.createTransaction = async function (data) {
    const branchId = data[constants.BRANCH]
    delete data[constants.BRANCH]
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branchSnapshot = await branchRef.get()
    if (!branchSnapshot.exists) {
        const error = new Error(`Requested branch is not present. Transaction will not go through.`)
        error.statusCode = 404
        next(error)
        return;
    }

    // Get the last transaction for the product to get the intialQuantity for current transaction
    const transactionRef = branchRef.collection(constants.TRANSACTIONS)
    try {
        const lastTransaction = await transactionRef
            .where(constants.PRODUCT, '==', data[constants.PRODUCT])
            .orderBy(constants.DATE, 'desc')
            .limit(1)
            .get();

        let initialQuantity = 0
        lastTransaction.forEach((transaction) => {
            initialQuantity = transaction.data()[constants.CLOSING_QUANTITY]
        })
        data[constants.INITIAL_QUANTITY] = initialQuantity
        data[constants.CLOSING_QUANTITY] = getClosingQuantity(data[constants.OPERATION], initialQuantity,
            data[constants.OPERATIONAL_QUANTITY])
        const resultTransaction = await transactionRef.add(data)
        return resultTransaction.id
    } catch (err) {
        logger.error(err)
        throw err
    }
}

/**
 * Method to calculate closing quantity for the current transaction
 * @param {} operation
 * @param {*} initialQuantity
 * @param {*} operationalQuantity
 */
function getClosingQuantity(operation, initialQuantity, operationalQuantity) {
    switch (operation) {
        case constants.ADD_PRODUCT:
        case constants.TRANSFER_IN:
            return initialQuantity + operationalQuantity
        case constants.ISSUE_PRODUCT:
        case constants.TRANSFER_OUT:
            return initialQuantity - operationalQuantity
        case constants.ADJUSTMENT:
            return operationalQuantity
    }
}

/**
 * Trigger to update availableQuantity and isBelowThreshold value after
 * a transaction is completed for a particular branch
 */
module.exports.updateAvailableQuantityInInventory = functions.firestore
    .document(`/${constants.BRANCHES}/{branch}/${constants.TRANSACTIONS}/{transactionId}`)
    .onWrite(async (snapshot, context) => {
        const transactionRecord = snapshot.after.data()
        const branchId = context.params.branch
        const productId = transactionRecord[constants.PRODUCT]
        logger.info(`Updating availableQuantity for product ${transactionRecord[constants.PRODUCT]} in branch ${branchId}`)

        const inventoryRef = await db.collection(constants.BRANCHES).doc(branchId)
                                .collection(constants.INVENTORY)
        const inventorySnapshot = await inventoryRef
                                .doc(productId)
                                .get()

        var data = {}
        if(!inventorySnapshot.exists) {
            const productSnapshot = await db.collection(constants.PRODUCTS)
                                        .doc(productId).get()
            
            data[constants.CATEGORY] = productSnapshot.get(constants.CATEGORY)
            data[constants.THRESHOLD] = productSnapshot.get(constants.THRESHOLDS)[branchId]
            data[constants.UNIT] = productSnapshot.get(constants.UNIT)
            //branchInventory[productId] = data
        } else {
            data = inventorySnapshot.data()
        }
        // const inventorySnapshot = await inventoryRef.get()
        // const branchInventory = inventorySnapshot.get(constants.INVENTORY)

        data[constants.AVAILABLE_QUANTITY]
            = transactionRecord[constants.CLOSING_QUANTITY]
        data[constants.IS_BELOW_THRESHOLD]
            = transactionRecord[constants.CLOSING_QUANTITY] < data[constants.THRESHOLD]
                ? true : false
        inventoryRef.doc(productId).set(data)
    });