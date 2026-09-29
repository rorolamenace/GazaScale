// OpenFreeMap Liberty, also used by the A412 observatory.
// Keep Leaflet in charge of gestures and geographic overlays.
window.installBasemap=function(map){
  const attribution='<a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
  let vector=null,loaded=false,fallback=null,timer;
  function useFallback(){
    clearTimeout(timer);
    if(fallback)return;
    if(vector&&map.hasLayer(vector))map.removeLayer(vector);
    fallback=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    map.getContainer().dataset.basemap='osm-fallback';
  }
  try{
    vector=MaplibreGLLeaflet.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty',interactive:false,attributionControl:{customAttribution:attribution}}).addTo(map);
    const gl=vector.getMaplibreMap();
    gl.once('load',()=>{loaded=true;clearTimeout(timer);map.getContainer().dataset.basemap='liberty';});
    gl.on('error',()=>{if(!loaded)useFallback();});
    gl.getCanvas().addEventListener('webglcontextlost',()=>useFallback(),{once:true});
    timer=setTimeout(()=>{if(!loaded)useFallback();},15000);
  }catch(error){useFallback();}
};
