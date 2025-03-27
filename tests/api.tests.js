const request = require("supertest");
const app = require("../server"); // Adjust if your server file has a different name

describe("API Tests", () => {
    it("GET /api/messages - should return all messages", async () => {
        const res = await request(app).get("/api/messages");
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    it("POST /api/messages - should create a new message", async () => {
        const res = await request(app)
            .post("/api/messages")
            .send({ message: "Test Message" });
        expect(res.statusCode).toEqual(201);
        expect(res.body.message).toBe("Test Message");
    });
});
