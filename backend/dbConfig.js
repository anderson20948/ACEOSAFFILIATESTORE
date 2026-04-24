const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'local_db.json');

// Initialize local DB if it doesn't exist
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({
    users: [],
    activities: [],
    password_resets: [],
    system_settings: [
      { key: 'brand_name', value: 'Aceos Affiliate Store' },
      { key: 'primary_color', value: '#ff5e14' },
      { key: 'logo_url', value: 'images/logo.png' }
    ],
    coupons: [],
    affiliate_tiers: [
      { id: '1', name: 'Bronze', threshold_earnings: 0, commission_multiplier: 1.0 },
      { id: '2', name: 'Silver', threshold_earnings: 1000, commission_multiplier: 1.1 },
      { id: '3', name: 'Gold', threshold_earnings: 5000, commission_multiplier: 1.25 }
    ]
  }, null, 2));
}

function readDb() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateId() {
  return uuidv4();
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.queryType = null;
    this.conditions = [];
    this.insertData = null;
    this.updateData = null;
    this.selectFields = '*';
    this.limitCount = null;
    this.orderField = null;
    this.orderDesc = false;
    this.singleResult = false;
  }

  // --- Scalability: In-memory Cache for high-frequency reads ---
  static cache = new Map();
  static CACHE_TTL = 5000; // 5 seconds cache for high-volume requests

  static getCache(key) {
    const cached = QueryBuilder.cache.get(key);
    if (cached && (Date.now() - cached.timestamp < QueryBuilder.CACHE_TTL)) {
      return cached.data;
    }
    return null;
  }

  static setCache(key, data) {
    QueryBuilder.cache.set(key, { data, timestamp: Date.now() });
  }

  select(fields = '*') {
    if (this.queryType !== 'insert' && this.queryType !== 'update') {
      this.queryType = 'select';
    }
    this.selectFields = fields;
    return this;
  }

  insert(data) {
    this.queryType = 'insert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this.queryType = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.queryType = 'delete';
    return this;
  }

  eq(field, value) {
    this.conditions.push({ type: 'eq', field, value });
    return this;
  }

  gt(field, value) {
    this.conditions.push({ type: 'gt', field, value });
    return this;
  }

  lt(field, value) {
    this.conditions.push({ type: 'lt', field, value });
    return this;
  }

  order(field, options = { ascending: true }) {
    this.orderField = field;
    this.orderDesc = !options?.ascending;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  execute() {
    const db = readDb();
    if (!db[this.table]) {
      db[this.table] = [];
    }
    
    let tableData = db[this.table];
    let result = { data: null, error: null };

    // --- Scalability: Check cache for SELECT queries ---
    const cacheKey = `${this.queryType}_${this.table}_${JSON.stringify(this.conditions)}_${this.limitCount}_${this.singleResult}`;
    if (this.queryType === 'select') {
      const cachedData = QueryBuilder.getCache(cacheKey);
      if (cachedData) {
        return Promise.resolve({ data: cachedData, error: null });
      }
    }

    try {
      if (this.queryType === 'insert') {
        // Clear cache for this table on modification
        QueryBuilder.cache.clear(); 
        const newRecords = this.insertData.map(item => ({
          id: item.id || generateId(),
          created_at: item.created_at || new Date().toISOString(),
          ...item
        }));
        db[this.table] = [...tableData, ...newRecords];
        writeDb(db);
        result.data = newRecords;
      } 
      else if (this.queryType === 'select') {
        let filtered = tableData.filter(item => this.matchConditions(item));
        
        if (this.orderField) {
          filtered.sort((a, b) => {
            if (a[this.orderField] < b[this.orderField]) return this.orderDesc ? 1 : -1;
            if (a[this.orderField] > b[this.orderField]) return this.orderDesc ? -1 : 1;
            return 0;
          });
        }
        
        if (this.limitCount !== null) {
          filtered = filtered.slice(0, this.limitCount);
        }

        if (this.singleResult) {
          if (filtered.length === 0) {
            result.error = { message: "No rows found" };
            result.data = null;
          } else {
            result.data = filtered[0];
          }
        } else {
          result.data = filtered;
        }

        // --- Scalability: Set cache ---
        if (result.data) {
          QueryBuilder.setCache(cacheKey, result.data);
        }
      }
      else if (this.queryType === 'update') {
        QueryBuilder.cache.clear(); 
        let updatedRecords = [];
        db[this.table] = tableData.map(item => {
          if (this.matchConditions(item)) {
            const updated = { ...item, ...this.updateData };
            updatedRecords.push(updated);
            return updated;
          }
          return item;
        });
        writeDb(db);
        result.data = updatedRecords;
      }
      else if (this.queryType === 'delete') {
        QueryBuilder.cache.clear(); 
        let deletedRecords = [];
        db[this.table] = tableData.filter(item => {
          if (this.matchConditions(item)) {
            deletedRecords.push(item);
            return false;
          }
          return true;
        });
        writeDb(db);
        result.data = deletedRecords;
      }
    } catch (err) {
      result.error = { message: err.message };
    }

    return Promise.resolve(result);
  }

  matchConditions(item) {
    if (this.conditions.length === 0) return true;
    return this.conditions.every(cond => {
      if (cond.type === 'eq') return item[cond.field] === cond.value;
      if (cond.type === 'gt') return item[cond.field] > cond.value;
      if (cond.type === 'lt') return item[cond.field] < cond.value;
      return true;
    });
  }

  // To allow `await db.from().select()`
  then(resolve, reject) {
    return this.execute().then(resolve).catch(reject);
  }
}

const localDbClient = {
  from: (table) => {
    return new QueryBuilder(table);
  },
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { session: null }, error: null })
  }
};

module.exports = { supabase: localDbClient, db: localDbClient };
