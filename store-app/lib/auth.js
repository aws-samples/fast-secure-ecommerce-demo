import { verify } from 'jsonwebtoken';

import config from '../aws-backend-config.json';

const SECRET_KEY = config.login_secret_key;

export function getUsername(req) {
    const list = {};
    const cookieHeader = req.headers?.cookie
  
    if (cookieHeader) {
        cookieHeader.split(`;`).forEach(function(cookie) {
            let [ name, ...rest] = cookie.split(`=`);
            name = name?.trim();
            if (!name) return;
            const value = rest.join(`=`).trim();
            if (!value) return;
            list[name] = decodeURIComponent(value);
          });
          const token = list.token;
        
          if (token) {
            try {
                const claims = verify(token, SECRET_KEY);
                return claims.username;
              } catch (error) {
                console.log(error);
              }
            
          }
    }
    return null;
  }
  