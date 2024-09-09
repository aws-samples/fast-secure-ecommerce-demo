import cf from 'cloudfront';
import crypto from 'crypto';
const kvsHandle = cf.kvs('__KVS_ID__'); // Will be replaced with the actual KVS ID

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function jwt_decode(token, key, noVerify, algorithm) {
    // check token
    if (!token) {
        throw new Error('No token supplied');
    }
    // check segments
    const segments = token.split('.');
    if (segments.length !== 3) {
        throw new Error('Not enough or too many segments');
    }

    // All segment should be base64
    const headerSeg = segments[0];
    const payloadSeg = segments[1];
    const signatureSeg = segments[2];

    // base64 decode and parse JSON
    const payload = JSON.parse(_base64urlDecode(payloadSeg));

    if (!noVerify) {
        const signingMethod = 'sha256';
        const signingType = 'hmac';

        // Verify signature. `sign` will return base64 string.
        const signingInput = [headerSeg, payloadSeg].join('.');

        if (!_verify(signingInput, key, signingMethod, signingType, signatureSeg)) {
            throw new Error('Signature verification failed');
        }

        // Support for nbf and exp claims.
        // According to the RFC, they should be in seconds.
        if (payload.nbf && Date.now() < payload.nbf*1000) {
            throw new Error('Token not yet active');
        }

        if (payload.exp && Date.now() > payload.exp*1000) {
            throw new Error('Token expired');
        }
    }

    return payload;
}

//Function to ensure a constant time comparison to prevent
//timing side channels.
function _constantTimeEquals(a, b) {
    if (a.length != b.length) {
        return false;
    }
    
    let xor = 0;
    for (let i = 0; i < a.length; i++) {
    xor |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    
    return 0 === xor;
}

function _verify(input, key, method, type, signature) {
    if(type === "hmac") {
        return _constantTimeEquals(signature, _sign(input, key, method));
    }
    else {
        throw new Error('Algorithm type not recognized');
    }
}

function _sign(input, key, method) {
    return crypto.createHmac(method, key).update(input).digest('base64url');
}

function _base64urlDecode(str) {
    return Buffer.from(str, 'base64url')
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    // check the user is already assigned to a segment, otherwise assign it to a random one. This is for A/B testing.
    var userSegment;
    if (request.cookies['user-segment']) {
        userSegment = request.cookies['user-segment'].value;
    } else {
        userSegment = `${randomIntFromInterval(1, 10)}`;
        request.headers['x-user-segment'] = { value: userSegment };
    }
    // apply rules
    try {
        const configRaw = await kvsHandle.get(request.uri);
        const config = JSON.parse(configRaw);

        /* example of config
        {
            "segments" : "1,2,3,4,5,6",
            "countries" : "AE,FR",
            "rules": {
                "rewrite_path" : "/index-v2"
            }
        }
        {
            "rules": {
                "redirect" : "/"
            }
        }
        {
            "rules": {
                "waitroom" : { 
                    "location" : "/waitroom"
                }
            }
        }
        */
        const segmentCondition = (!config.segments) || ((config.segments) && ((config.segments === "all") || (config.segments.includes(userSegment))));
        const countryCondition = (!config.countries) || ((config.countries) && (headers['cloudfront-viewer-country']) && (config.countries.includes(headers['cloudfront-viewer-country'].value)));

        if (segmentCondition && countryCondition) {
            if (config.rules) {
                if (config.rules.rewrite_path) {
                    request.uri = config.rules.rewrite_path;
                    return request;
                } else if (config.rules.redirect) {
                    return {
                        statusCode: 302,
                        statusDescription: 'Found',
                        headers: { location: { value: config.rules.redirect} },
                    }
                } else if ((config.rules.waitroom) && (config.rules.waitroom.location)) {
                    var waitroom = true;
                    if (request.cookies['token']) {
                        try { 
                            const secretKey = await kvsHandle.get('_secretkey');
                            const payload = jwt_decode(request.cookies['token'].value, secretKey);
                            if ((payload.premium) && (payload.premium === "yes")) waitroom = false;
                        } catch(e) {
                            console.log(e);
                        }
                    }     
                    if (waitroom) {
                        request.uri = config.rules.waitroom.location;
                        return request;
                    }
                }
            }

        }
    } catch (err) {
        // console.log(err);
    }
    return request; // move forward with request normally
    
}
