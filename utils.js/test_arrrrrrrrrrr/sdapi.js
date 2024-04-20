import axios from "axios";
import crypto from 'crypto';
import { arrrrrrrrrrPool } from "../../config/arrrrrrrrrr-db.js";
import util from 'util';
import _ from "lodash";

const API_URL = 'https://prd-sdv2-api.slotsdiamond.com';

const settingSecretKey = (body = {}) => {
    const secret_key = '71366219855044100';
    const request_arr = body;
    const bodydata = JSON.stringify(request_arr);
    const auth_key = crypto.createHash('md5').update(secret_key + bodydata).digest("hex");
    return auth_key;
}

const defaultHeader = (token) => {
    return {
        'Authorization': `Bearer ${token}`,
        'client_id': '1643',
        'Content-Type': 'application/json',
    }
}
const randomBytesPromise = util.promisify(crypto.randomBytes);
const pbkdf2Promise = util.promisify(crypto.pbkdf2);
const createSalt = async () => {
    const buf = await randomBytesPromise(64);
    return buf.toString("base64");
};
export const createHashedPassword = async (password, salt_) => {
    let salt = salt_;
    if (!salt) {
        salt = await createSalt();
    }
    const key = await pbkdf2Promise(password, salt, 104906, 64, "sha512");
    const hashedPassword = key.toString("base64");
    return { hashedPassword, salt };
};

const THIRD_PARTY_ID = 1;

const createAccount = async () => {
    try {
        const body = {
            username: 'test123213213212',
            password: 'test123213213212',
            email: 'test123213213212@naver.com',
            first_name: 'kimtest',
            last_name: '',
            mobile_no: '2156165165',
        };

        let { data: response } = await axios.post(`${API_URL}/apiprod-slotsdiamond/createaccount`, body, {
            headers: defaultHeader(settingSecretKey(body)),
        });
        let user = response?.data;
        if (response?.status == '0') {
            let exist_user = await arrrrrrrrrrPool.query(`SELECT * FROM users WHERE third_party_id=? AND third_party_user_id=?`, [
                THIRD_PARTY_ID,
                user?.user_id,
            ])
            exist_user = exist_user?.result[0];
            if (!exist_user) {
                let hash = (await createHashedPassword(body.password,));
                let salt = hash.salt
                let password = hash.hashedPassword;

                let columns = [
                    'user_name',
                    'user_code',
                    'password',
                    'salt',
                    'email',
                    'first_name',
                    'last_name',
                    'mobile_no',
                    'token',
                    'third_party_id',
                    'third_party_user_id',
                ]
                let quest_list = columns.map(el => { return '?' });
                let result = await arrrrrrrrrrPool.query(`INSERT INTO users (${columns.join()}) VALUES (${quest_list.join()})`, [
                    user?.username,
                    user?.usercode,
                    password,
                    salt,
                    body.email,
                    body.first_name,
                    body.last_name,
                    body.mobile_no,
                    user?.token,
                    THIRD_PARTY_ID,
                    user?.user_id,
                ])
            } else {
                let result = await arrrrrrrrrrPool.query(`UPDATE users SET token=? WHERE third_party_id=? AND third_party_user_id=?`, [
                    user?.token,
                    THIRD_PARTY_ID,
                    user?.user_id,
                ])
            }
        }
    } catch (err) {
        console.log(err?.response?.data)
    }
}
const getCategories = async () => {
    try {
        const body = {
            language_id: '2',
            provider_id: '',
        };

        let { data: response } = await axios.post(`${API_URL}/apiprod-slotsdiamond/getcategories`, body, {
            headers: defaultHeader(settingSecretKey(body)),
        });
        let category_list = response?.data ?? [];
        let category_id_list = category_list.map(el => { return el?.id });
        if (response?.status == '0') {
            let category_exist_list = await arrrrrrrrrrPool.query(`SELECT * FROM categories WHERE third_party_id=? AND third_party_category_id IN (${category_id_list.join()})`, [
                THIRD_PARTY_ID
            ]);
            category_exist_list = category_exist_list?.result;
            let insert_category_list = [];
            for (var i = 0; i < category_list.length; i++) {
                if (_.find(category_exist_list, { third_party_category_id: parseInt(category_list[i]?.id) })) {
                    let result = await arrrrrrrrrrPool.query(`UPDATE categories SET total_game=?, title=? WHERE third_party_category_id=? AND third_party_id=? `, [
                        category_list[i]?.total_game,
                        category_list[i]?.category_title,
                        category_list[i]?.id,
                        THIRD_PARTY_ID,
                    ])
                } else {
                    insert_category_list.push([
                        category_list[i]?.total_game,
                        category_list[i]?.category_title,
                        category_list[i]?.id,
                        THIRD_PARTY_ID,
                    ])
                }
            }
            let columns = [
                'total_game',
                'title',
                'third_party_category_id',
                'third_party_id',
            ]
            if (insert_category_list.length > 0) {
                let insert_result = await arrrrrrrrrrPool.query(`INSERT INTO categories (${columns}) VALUES ?`, [insert_category_list]);
            }
        }
    } catch (err) {
        console.log(err?.response?.data)
    }
}
const getProviders = async () => {
    try {
        const body = {
            language_id: '2',
        };

        let { data: response } = await axios.post(`${API_URL}/apiprod-slotsdiamond/getproviders`, body, {
            headers: defaultHeader(settingSecretKey(body)),
        });
        let provider_list = response?.data ?? [];
        let provider_id_list = provider_list.map(el => { return el?.provider_id });
        if (response?.status == '0') {
            let provider_exist_list = await arrrrrrrrrrPool.query(`SELECT * FROM providers WHERE third_party_id=? AND third_party_provider_id IN (${provider_id_list.join()})`, [
                THIRD_PARTY_ID
            ]);
            provider_exist_list = provider_exist_list?.result;
            let insert_provider_list = [];
            for (var i = 0; i < provider_list.length; i++) {
                if (_.find(provider_exist_list, { third_party_provider_id: parseInt(provider_list[i]?.provider_id) })) {
                    let result = await arrrrrrrrrrPool.query(`UPDATE providers SET logo_img=?, title=? WHERE third_party_provider_id=? AND third_party_id=? `, [
                        provider_list[i]?.provider_logo,
                        provider_list[i]?.provider_title,
                        provider_list[i]?.provider_id,
                        THIRD_PARTY_ID,
                    ])
                } else {
                    insert_provider_list.push([
                        provider_list[i]?.provider_logo,
                        provider_list[i]?.provider_title,
                        provider_list[i]?.provider_id,
                        THIRD_PARTY_ID,
                    ])
                }
            }
            let columns = [
                'logo_img',
                'title',
                'third_party_provider_id',
                'third_party_id',
            ]
            if (insert_provider_list.length > 0) {
                let insert_result = await arrrrrrrrrrPool.query(`INSERT INTO providers (${columns}) VALUES ?`, [insert_provider_list]);
            }
        }
    } catch (err) {
        console.log(err?.response?.data)
    }
}
const getGameList = async () => {
    try {
        const body = {
            lang: 'KO'
        };
        let { data: response } = await axios.post(`${API_URL}/apiprod-slotsdiamond/getselectedgameblockedlist`, body, {
            headers: defaultHeader(settingSecretKey(body)),
        });
        console.log(response)
    } catch (err) {
        console.log(err?.response?.data)
    }
}
getGameList();
const getGamesRankWise = async () => {
    try {
        const body = {
            language_id: '2',
            limit: '20',
            offset: '0',
        };

        let { data: response } = await axios.post(`${API_URL}/apiprod-slotsdiamond/getGameRankWise`, body, {
            headers: defaultHeader(settingSecretKey(body)),
        });
        console.log(response)
    } catch (err) {
        console.log(err?.response?.data)
    }
}
export {
    createAccount,
    getCategories,
    getProviders,
    getGameList,
    getGamesRankWise,
}