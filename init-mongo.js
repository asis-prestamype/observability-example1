// MongoDB initialization script
db = db.getSiblingDB('observability');

// Create collections
db.createCollection('users');
db.createCollection('tasks');

// Create indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": 1 });
db.tasks.createIndex({ "userId": 1 });
db.tasks.createIndex({ "status": 1 });
db.tasks.createIndex({ "createdAt": 1 });

// Insert sample data
db.users.insertMany([
    {
        _id: ObjectId(),
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: ObjectId(),
        name: "Jane Smith",
        email: "jane@example.com",
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

const johnId = db.users.findOne({ email: "john@example.com" })._id;
const janeId = db.users.findOne({ email: "jane@example.com" })._id;

db.tasks.insertMany([
    {
        _id: ObjectId(),
        title: "Complete project setup",
        description: "Set up the observability project with proper monitoring",
        status: "pending",
        userId: johnId,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: ObjectId(),
        title: "Write documentation",
        description: "Document the API endpoints and setup instructions",
        status: "completed",
        
        userId: janeId,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print("Database initialization completed successfully!");