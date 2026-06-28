const { Client } = require("pg");

const DB_HOST = "localhost";
const DB_PORT = 5432;
const DB_USER = "n8n";
const DB_PASSWORD = "n8n_password_change_me";
const TARGET_DATABASE = "dev_geek_week";

const adminConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: "postgres",
};

const appConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: TARGET_DATABASE,
};

const users = [
  { name: "Alice Johnson", email: "alice@example.com" },
  { name: "Bob Smith", email: "bob@example.com" },
  { name: "Carol Davis", email: "carol@example.com" },
];

const cars = [
  { make: "Toyota", model: "Camry", year: 2020, license_plate: "ABC-123" },
  { make: "Honda", model: "Civic", year: 2019, license_plate: "XYZ-789" },
  { make: "Tesla", model: "Model 3", year: 2022, license_plate: "TSL-001" },
  { make: "Ford", model: "F-150", year: 2021, license_plate: "FRD-555" },
];

const userCarRelations = [
  { userEmail: "alice@example.com", licensePlate: "ABC-123", relationType: "owner" },
  { userEmail: "alice@example.com", licensePlate: "TSL-001", relationType: "owner" },
  { userEmail: "bob@example.com", licensePlate: "XYZ-789", relationType: "owner" },
  { userEmail: "carol@example.com", licensePlate: "FRD-555", relationType: "owner" },
  { userEmail: "bob@example.com", licensePlate: "TSL-001", relationType: "driver" },
];

async function ensureDatabaseExists() {
  const client = new Client(adminConfig);
  await client.connect();

  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TARGET_DATABASE]
  );

  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${TARGET_DATABASE}`);
    console.log(`Created database: ${TARGET_DATABASE}`);
  } else {
    console.log(`Database already exists: ${TARGET_DATABASE}`);
  }

  await client.end();
}

async function createSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cars (
      id SERIAL PRIMARY KEY,
      make VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      year INTEGER NOT NULL CHECK (year >= 1900),
      license_plate VARCHAR(20) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS user_cars (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
      relation_type VARCHAR(50) NOT NULL DEFAULT 'owner',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, car_id, relation_type)
    );
  `);
}

async function seedData(client) {
  await client.query("TRUNCATE TABLE user_cars, cars, users RESTART IDENTITY CASCADE");

  const userIdsByEmail = new Map();
  for (const user of users) {
    const result = await client.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, email",
      [user.name, user.email]
    );
    userIdsByEmail.set(result.rows[0].email, result.rows[0].id);
  }

  const carIdsByPlate = new Map();
  for (const car of cars) {
    const result = await client.query(
      "INSERT INTO cars (make, model, year, license_plate) VALUES ($1, $2, $3, $4) RETURNING id, license_plate",
      [car.make, car.model, car.year, car.license_plate]
    );
    carIdsByPlate.set(result.rows[0].license_plate, result.rows[0].id);
  }

  for (const relation of userCarRelations) {
    const userId = userIdsByEmail.get(relation.userEmail);
    const carId = carIdsByPlate.get(relation.licensePlate);

    await client.query(
      "INSERT INTO user_cars (user_id, car_id, relation_type) VALUES ($1, $2, $3)",
      [userId, carId, relation.relationType]
    );
  }
}

async function printSummary(client) {
  const summary = await client.query(`
    SELECT
      u.name AS user_name,
      u.email,
      c.make,
      c.model,
      c.year,
      c.license_plate,
      uc.relation_type
    FROM user_cars uc
    JOIN users u ON u.id = uc.user_id
    JOIN cars c ON c.id = uc.car_id
    ORDER BY u.name, c.license_plate, uc.relation_type
  `);

  console.log("\nSeeded user-car relations:");
  for (const row of summary.rows) {
    console.log(
      `- ${row.user_name} (${row.relation_type}) -> ${row.year} ${row.make} ${row.model} [${row.license_plate}]`
    );
  }
}

async function main() {
  await ensureDatabaseExists();

  const client = new Client(appConfig);
  await client.connect();

  try {
    await createSchema(client);
    await seedData(client);
    await printSummary(client);
    console.log(`\nSeed completed successfully in database "${TARGET_DATABASE}".`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
