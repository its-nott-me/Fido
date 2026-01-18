import axios from 'axios';
import { env } from '../../loadenv.ts';

const instance = axios.create({
    baseURL: `${env.API_URL}`,
});

export default instance;
