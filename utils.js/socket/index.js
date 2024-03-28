import io from "socket.io-client";
import 'dotenv/config';
import { insertQuery } from "../query-util.js";
import { commarNumber } from "../util.js";

const socket = io.connect(process.env.SOCKET_URL);

export const emitSocket = async (item) => {
    let { method, data, brand_id } = item;
    try {
        let title = '';
        let message = '';
        let link = '';
        if (method == 'settle_request') {
            title = '보유정산금 요청건이 들어왔습니다.';
            message = `${data?.nickname}님이 보유정산금 ${commarNumber(data?.amount)} 원을 요청하였습니다.`;
            let result = await insertQuery(`bell_contents`, {
                brand_id,
                user_id: data?.user_id ?? 0,
                title,
                message,
                link: `/manager/settle/request-list`,
            })
        } else if (method == 'settle_plus') {
            title = '보유정산금 지급건이 들어왔습니다.';
            message = `${data?.nickname}님이 보유정산금 ${commarNumber(data?.amount)} 원을 지급 받았습니다.`
            let result = await insertQuery(`bell_contents`, {
                brand_id,
                user_id: data?.user_id ?? 0,
                title,
                message,
                link: `/manager/settle/list`,
            })
        }
        socket.emit("message", { method, data, brand_id, title });
    } catch (err) {
        console.log(err);
    }
}