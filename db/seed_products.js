const { pool } = require('../dbConfig');

const products = [
    {
        title: "Amazon Echo Dot (5th Gen)",
        description: "The best-sounding Echo Dot yet. Enjoy an improved audio experience compared to any previous Echo Dot with Alexa for clearer vocals, deeper bass and vibrant sound in any room.",
        price: 49.99,
        category: "Electronics",
        image_url: "/images/amazon_echo.png",
        status: "approved"
    },
    {
        title: "Adidas Ultraboost Light",
        description: "Experience epic energy with the new Ultraboost Light, our lightest Ultraboost ever. The magic lies in the Light BOOST midsole, a new generation of Adidas BOOST.",
        price: 190.00,
        category: "Sportswear",
        image_url: "/images/adidas_ultraboost.png",
        status: "approved"
    },
    {
        title: "Samsung Galaxy Watch 6",
        description: "Your path to wellness starts here. Get the insights you need to be at your best with Galaxy Watch 6. Improved sleep tracking, personalized heart rate zones, and sleek design.",
        price: 299.99,
        category: "Electronics",
        image_url: "/images/rakuten_watch.png",
        status: "approved"
    }
];

async function seed() {
    console.log("Seeding products...");
    try {
        for (const product of products) {
            await pool.query(
                "INSERT INTO products (title, description, price, category, image_url, status) VALUES ($1, $2, $3, $4, $5, $6)",
                [product.title, product.description, product.price, product.category, product.image_url, product.status]
            );
            console.log(`Seeded: ${product.title}`);
        }
        console.log("Seeding completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err.message);
        process.exit(1);
    }
}

seed();
