const keys = require("./keys");
const express = require("express");

// Express app setup
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres client setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.postgresUser,
  password: keys.postgresPassword,
  database: keys.postgresDb,
  host: keys.postgresHost,
  port: keys.postgresPort,
});

pgClient.on('error', () => console.error('Lost PG connection'));
pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.error(err));

// Redis client setup
const redis = require("redis");
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, resp) => resp.send('Hi'));

app.get('/values/all', async (req, resp) => {
  try {
    const values = await pgClient.query('SELECT * FROM VALUES');
    resp.send(values.rows);
  } catch {
    resp.status(500).send('Something went wrong');
  }
});

app.get('/values/current', async (req, resp) => {
  redisClient.hgetall('values', (err, values) => resp.send(values));
});

app.post('/values/input', async (req, resp) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return resp.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  console.log('publishing to "insert" channel');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES ($1)', [index]);

  resp.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});
