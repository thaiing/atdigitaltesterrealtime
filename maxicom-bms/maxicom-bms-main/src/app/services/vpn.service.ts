import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface IpsecConnection {
  name: string;
  category: 'site-to-site' | 'remote-access';
  auth_method: 'ikev2-psk' | 'ikev2-cert';
  remote_address?: string;
  local_identity?: string;
  remote_identity?: string;
  pre_shared_key?: string;
  local_traffic_selector?: string;
  remote_traffic_selector?: string;
  server_certificate_name?: string;
  ca_certificate_name?: string;
  status?: 'IDLE' | 'CONNECTING' | 'ESTABLISHED' | 'FAILED' | 'UNKNOWN';
  ike_version?: string;
  server_address?: string;
  start_action?: string;
}

export interface OpenVpnConnection {
  name: string;
  type: 'server' | 'client';
  protocol: 'udp' | 'tcp';
  port?: number;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VpnService {
  private ipsecApiUrl = '/api/vpn/connections';
  private openvpnApiUrl = '/api/openvpn/connections';

  constructor(private http: HttpClient) {
  }

  // ===== IPsec Methods =====
  getIpsecConnections(): Observable<IpsecConnection[]> {
    return this.http.get<IpsecConnection[]>(this.ipsecApiUrl);
  }

  getIpsecConnection(name: string): Observable<IpsecConnection> {
    return this.http.get<IpsecConnection>(`${this.ipsecApiUrl}/${name}`);
  }

  createIpsecConnection(data: Partial<IpsecConnection>): Observable<any> {
    return this.http.post(this.ipsecApiUrl, {...data, andUpdate: true});
  }

  updateIpsecConnection(name: string, data: Partial<IpsecConnection>): Observable<any> {
    return this.http.put(`${this.ipsecApiUrl}/${name}`, {...data, andUpdate: true});
  }

  deleteIpsecConnection(name: string): Observable<any> {
    return this.http.delete(`${this.ipsecApiUrl}/${name}`);
  }

  startIpsecConnection(name: string): Observable<any> {
    return this.http.post(`${this.ipsecApiUrl}/${name}/start`, {});
  }

  stopIpsecConnection(name: string): Observable<any> {
    return this.http.post(`${this.ipsecApiUrl}/${name}/stop`, {});
  }

  // ===== OpenVPN Methods (Placeholder for future) =====
  getOpenVpnConnections(): Observable<OpenVpnConnection[]> {
    return new Observable(observer => {
      observer.next([]);
      observer.complete();
    });
  }
}
