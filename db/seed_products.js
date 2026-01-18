const { pool } = require('../dbConfig');

const products = [
    // Amazon Products
    {
        title: "Amazon Echo Dot (5th Gen)",
        description: "The best-sounding Echo Dot yet. Enjoy an improved audio experience compared to any previous Echo Dot with Alexa for clearer vocals, deeper bass and vibrant sound in any room.",
        price: 49.99,
        category: "Electronics",
        image_url: "/images/amazon_echo.png",
        status: "approved"
    },
    {
        title: "Amazon Kindle Paperwhite",
        description: "Now waterproof with 2x the storage. Adjustable warm light, 6.8\" display, and weeks of battery life. Perfect for reading anywhere, anytime.",
        price: 139.99,
        category: "Electronics",
        image_url: "/images/amazon_kindle.png",
        status: "approved"
    },
    {
        title: "Amazon Fire TV Stick Lite",
        description: "Stream your favorite shows and movies with the all-new Fire TV Stick Lite. Enjoy thousands of channels, apps, and Alexa skills.",
        price: 39.99,
        category: "Electronics",
        image_url: "/images/amazon_fire_tv.png",
        status: "approved"
    },
    {
        title: "Amazon Ring Video Doorbell",
        description: "Never miss a visitor with 1080p HD video, motion detection, and two-way audio. Connect with your smartphone for live viewing.",
        price: 59.99,
        category: "Smart Home",
        image_url: "/images/amazon_ring.png",
        status: "approved"
    },

    // Adidas Products
    {
        title: "Adidas Ultraboost Light",
        description: "Experience epic energy with the new Ultraboost Light, our lightest Ultraboost ever. The magic lies in the Light BOOST midsole, a new generation of Adidas BOOST.",
        price: 190.00,
        category: "Sportswear",
        image_url: "/images/adidas_ultraboost.png",
        status: "approved"
    },
    {
        title: "Adidas Stan Smith Shoes",
        description: "The iconic Stan Smith sneakers featuring the signature green heel tab and perforated 3-Stripes. A timeless classic for any wardrobe.",
        price: 75.00,
        category: "Footwear",
        image_url: "/images/adidas_stan_smith.png",
        status: "approved"
    },
    {
        title: "Adidas Originals Track Jacket",
        description: "Classic track jacket with 3-Stripes down the sleeves. Made with recycled materials, featuring the iconic Trefoil logo.",
        price: 65.00,
        category: "Apparel",
        image_url: "/images/adidas_track_jacket.png",
        status: "approved"
    },
    {
        title: "Adidas Predator Football Boots",
        description: "Engineered for precision and control. HybridTouch upper technology for enhanced ball touch and grip on the pitch.",
        price: 250.00,
        category: "Sportswear",
        image_url: "/images/adidas_predator.png",
        status: "approved"
    },

    // Rakuten/Samsung Products (Lifestyle and Tech)
    {
        title: "Samsung Galaxy Watch 6",
        description: "Your path to wellness starts here. Get the insights you need to be at your best with Galaxy Watch 6. Improved sleep tracking, personalized heart rate zones, and sleek design.",
        price: 299.99,
        category: "Electronics",
        image_url: "/images/rakuten_watch.png",
        status: "approved"
    },
    {
        title: "Samsung Galaxy Buds2 Pro",
        description: "Premium wireless earbuds with intelligent noise cancelling, 360 Audio, and 8 hours of battery life. Perfect sound for music and calls.",
        price: 229.99,
        category: "Electronics",
        image_url: "/images/samsung_buds.png",
        status: "approved"
    },
    {
        title: "Samsung 55\" 4K Smart TV",
        description: "Crystal clear 4K resolution with HDR10+ support. Smart TV powered by Tizen OS with built-in streaming apps and voice control.",
        price: 599.99,
        category: "Electronics",
        image_url: "/images/samsung_tv.png",
        status: "approved"
    },
    {
        title: "Samsung Galaxy Tab S8",
        description: "Powerful Android tablet with S Pen included. 11\" display, Snapdragon processor, and all-day battery life for work and entertainment.",
        price: 699.99,
        category: "Electronics",
        image_url: "/images/samsung_tab.png",
        status: "approved"
    },

    // Additional Lifestyle Products
    {
        title: "Sony WH-1000XM5 Headphones",
        description: "Industry-leading noise cancelling wireless headphones with 30-hour battery life. Premium sound quality and comfort for all-day listening.",
        price: 349.99,
        category: "Electronics",
        image_url: "/images/sony_headphones.png",
        status: "approved"
    },
    {
        title: "Nike Air Max 270",
        description: "Inspired by two icons - the Air Max 180 and Air Max 93. Features the largest heel Air unit yet for incredible cushioning.",
        price: 150.00,
        category: "Footwear",
        image_url: "/images/nike_airmax.png",
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
