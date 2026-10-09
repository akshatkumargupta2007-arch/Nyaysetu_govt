import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The screens use the global `L` (Leaflet), so it is placed on window before the heat-map plugin loads.
window.L = L;
export default L;
