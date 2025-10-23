import request from 'request-promise';

const verifyRecaptcha = async (req, res) => {
    const response_key = req.body["g-recaptcha-response"];
    const secret_key = "<generated_site_key>"; // Replace with your actual secret key

    const options = {
        uri: `https://www.google.com/recaptcha/api/siteverify?secret=${secret_key}&response=${response_key}`,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method: 'POST',
    };

    try {
        const re = await request(options);
        const result = JSON.parse(re);

        if (!result.success) {
            return res.send({ response: "Failed" });
        }

        return res.send({ response: "Successful" });
    } catch (error) {
        return res.send({ response: "Failed" });
    }
};

export default verifyRecaptcha;
