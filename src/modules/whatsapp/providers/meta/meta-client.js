import axios from 'axios';
import env from '../../../../config/env.js';

export class MetaClient {
  constructor(accessToken) {
    const baseUrl = env.META_GRAPH_API_BASE_URL;
    const version = env.META_GRAPH_API_VERSION;
    
    this.client = axios.create({
      baseURL: `${baseUrl}/${version}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async getMe() {
    const res = await this.client.get('/me');
    return res.data;
  }

  async getPhoneNumberDetails(phoneNumberId) {
    const res = await this.client.get(`/${phoneNumberId}`, {
      params: {
        fields: 'display_phone_number,verified_name',
      },
    });
    return res.data;
  }

  async getWabaDetails(wabaId) {
    const res = await this.client.get(`/${wabaId}`);
    return res.data;
  }
}
