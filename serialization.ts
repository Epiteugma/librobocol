import Heartbeat from './packets/heartbeat';
import Gamepad from './packets/gamepad';
import PeerDiscovery from './packets/peerDiscovery';
import Command from './packets/command';
import Telemetry from './packets/telemetry';
import KeepAlive from './packets/keepAlive';

export type DeserializeResult = Heartbeat | Gamepad | PeerDiscovery | Command | Telemetry | KeepAlive | undefined;

export function deserialize(buf: Uint8Array): DeserializeResult {
    let packet: DeserializeResult;

    switch (buf[0]) {
        case (packet = new Heartbeat()).uid:
        case (packet = new Gamepad()).uid:
        case (packet = new PeerDiscovery()).uid:
        case (packet = new Command()).uid:
        case (packet = new Telemetry()).uid:
        case (packet = new KeepAlive()).uid:
            break;
    }

    return packet?.deserialize(buf);
}