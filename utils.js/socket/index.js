import io from "socket.io-client";
import 'dotenv/config';
import { insertQuery } from "../query-util.js";
import { commarNumber } from "../util.js";

const socket = io.connect(process.env.SOCKET_URL);

export const emitSocket = async (item) => {
    let { method, data, brand_id } = item;
    try {
        let title = '';
        if (method == 'settle_request') {
            title = '보유정산금 요청건이 들어왔습니다..';
            let result = await insertQuery(`bell_contents`, {
                brand_id,
                user_id: data?.user_id ?? 0,
                title,
                message: `${data?.nickname}님이 보유정산금 ${commarNumber(data?.amount)} 원을 요청하였습니다.`,
                link: `/manager/settle/request-list`,
            })
        }
        socket.emit("message", { method, data, brand_id, title });
    } catch (err) {
        console.log(err);
    }
}