"use strict";

const { ServiceSchemaError } = require("moleculer").Errors;
const firebase = require("firebase");
require("firebase/firestore");

class CloudFireStoreDbAdapter {
  /**
   * Creates an instance of CloudFireStoreDbAdapter.
   * @param {String} apiKey
   * @param {String} projectId
   *
   * @memberof CloudFireStoreDbAdapter
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * Initialize adapter
   *
   * @param {ServiceBroker} broker
   * @param {Service} service
   *
   * @memberof CloudFireStoreDbAdapter
   */
  init(broker, service) {
    this.broker = broker;

    this.service = service;
    if (!this.service.schema.collection) {
      throw new ServiceSchemaError(
        "Missing 'collection' definition in schema of service!"
      );
    }

    if (!firebase.apps.length) {
      this.instance = firebase.initializeApp(this.options);
    }else {
      firebase.app(); // if already initialized, use that one
    }

    // this.instance = firebase.initializeApp(options);
  }

  /**
   * Connect to database
   *
   * @memberof CloudFireStoreDbAdapter
   */
  connect() {
    this.db = this.instance.firestore();
    this.collection = this.db.collection(this.service.schema.collection);
  }

  /**
   * Disconnects from DB
   *
   * @memberof CloudFireStoreDbAdapter
   */
  disconnect() {
    this.db = null;
    this.collection = null;
  }

  /**
   * Parse DocumentSnapshot to object
   *
   * @param {Object} DocumentSnapshot
   *
   * @returns {Object} document
   *
   * @memberof CloudFireStoreDbAdapter
   */
  parseDocSnapshot(docSnapshot) {
    return docSnapshot.data();
  }

  /**
   * Parse QuerySnapshot to object
   *
   * @param {Object} QuerySnapshot
   *
   * @returns {Object} a mapping of ids  to found documents
   *
   * @memberof CloudFireStoreDbAdapter
   */
  parseQuerySnapshot(querySnapshot) {
    const docs = {};

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      docs[data._id] = data;
    });

    return docs;
  }

  /**
   * List documents with pagination
   *
   * @returns {Object} containing 'docs' and 'nextQuery'
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async list(limit, orderBy, nextQuery) {
    let querySnapshot;

    if (nextQuery) {
      querySnapshot = await nextQuery.get();
      const docs = this.parseQuerySnapshot(querySnapshot);
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

      let next = this.collection;
      if (orderBy) {
        next = next.orderBy(orderBy).limit(limit);
      }
      next = next.startAfter(lastVisible);

      return { docs, next };
    } else {
      if (orderBy) {
        const first = this.collection.orderBy(orderBy).limit(limit);
        querySnapshot = await first.get();
        const docs = this.parseQuerySnapshot(querySnapshot);
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        const next = this.collection
          .orderBy(orderBy)
          .startAfter(lastVisible)
          .limit(limit);
        return { docs, next };
      } else {
        querySnapshot = await this.collection.get();
        return this.parseQuerySnapshot(querySnapshot);
      }
    }
  }

  /**
   * List all documents
   *
   * @returns {Object} a mapping of ids  to found documents
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async getAll() {
    const querySnapshot = await this.collection.get();
    return this.parseQuerySnapshot(querySnapshot);
  }

  /**
   * Find documents
   *
   * @param {Array?<Array<String>} conditions
   * @param {Number?} limit
   * @param {Array?<String>} orderBy
   *
   * @returns {Object} a mapping of ids  to found documents
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async find({ conditions, limit, orderBy }) {
    let query = this.collection;

    if (conditions && conditions.length > 0) {
      conditions.map(([key, operator, value]) => {
        query = query.where(key, operator, value);
      });
    }

    if (limit) {
      query = query.limit(limit);
    }

    if (orderBy && orderBy.length > 0) {
      orderBy.map((key) => {
        query = query.orderBy(key);
      });
    }

    const querySnapshot = await query.get();
    return this.parseQuerySnapshot(querySnapshot);
  }

  /**
   * Get a document by ID
   *
   * @param {String|UUID} id
   *
   * @returns {Object} document
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async findById(id) {
    const docRef = this.collection.doc(id);
    const docSnapshot = await docRef.get();
    return this.parseDocSnapshot(docSnapshot);
  }

  /**
   * Get documents by their ID
   *
   * @param {Array<String>|Array<UUID>} id
   *
   * @returns {Object} a mapping of ids  to found documents
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async findByIds(ids) {
    return await this.find({ conditions: [["_id", "in", ids]] });
  }

  /**
   * Create a document
   *
   * @param {Object} document
   *
   * @returns {Object} document
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async create(entity) {
    await this.collection.doc(entity._id).set(entity);
    return this.findById(entity._id);
  }

  /**
   * Update a document
   *
   * @param {String|UUID} id
   * @param {Object} values
   *
   * @returns {Object} document
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async update(id, values) {
    const docRef = this.collection.doc(id);
    await docRef.update(values);
    return this.findById(id);
  }

  /**
   * Delete a document
   *
   * @param {String|UUID} id
   *
   * @returns {Object} document
   *
   * @memberof CloudFireStoreDbAdapter
   */
  async delete(id) {
    const docRef = this.collection.doc(id);
    const docSnapshot = await docRef.get();
    const docData = this.parseDocSnapshot(docSnapshot);

    await docRef.delete();
    return docData;
  }
}

module.exports = CloudFireStoreDbAdapter;
