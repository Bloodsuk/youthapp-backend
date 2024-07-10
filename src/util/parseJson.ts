export default function parseJson(json: string, placeholder: object = {}) {
  if(!json) return placeholder;
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    console.log("Invalid JSON: " + error);
    console.log("JSON: " + json);
    
    return placeholder;
  }
}