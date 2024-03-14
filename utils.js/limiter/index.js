import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 1000 * 5, //1초 ... 15 * 60 * 1000 15분
    max: 5,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        rate_limiter: 1
    },
    handler: function (req, res) {
        res.status(429).send({
            rate_limiter: 1
        });
    }
});

export {
    limiter
}