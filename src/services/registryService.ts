import { DetectionResult } from "./anprService";

/**
 * Registry Service (Vahan integration simulation)
 * In a production environment, this would call real RTO/Registry APIs.
 * It simulates retrieving owner and vehicle registration details based on the plate.
 */

// Mock database for demonstration
const REGISTRY_DB: Record<string, Partial<DetectionResult>> = {
  "MH12DE1433": {
    owner: "Sagarika Jena",
    registration_date: "12-Aug-2021",
    fuel_type: "Petrol",
    engine_no: "G4LAEM521433",
    chassis_no: "MALAA51CLAM001433",
    insurance_expiry: "11-Aug-2025"
  },
  "DL1CA1234": {
    owner: "Aditya Sharma",
    registration_date: "05-Jan-2019",
    fuel_type: "Diesel",
    engine_no: "D4EBHM101234",
    chassis_no: "WBAA51CH0M001234",
    insurance_expiry: "04-Jan-2024"
  },
  "KA01MJ4567": {
    owner: "Priya Lakshmi",
    registration_date: "22-Oct-2022",
    fuel_type: "Electric",
    engine_no: "EV700M104567",
    chassis_no: "MALAA51EKAM004567",
    insurance_expiry: "21-Oct-2027"
  }
};

export const lookupRegistryDetails = async (plate: string): Promise<Partial<DetectionResult>> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const cleanedPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  // Return mock data if plates match, else return a plausible generated profile
  if (REGISTRY_DB[cleanedPlate]) {
    return REGISTRY_DB[cleanedPlate];
  }

  // Generate plausible data for unknown plates for UI demonstration
  return {
    owner: "Registered Owner (RTO Restricted)",
    registration_date: "2018-2024 (Estimated)",
    fuel_type: "Petrol/Diesel",
    engine_no: "********" + cleanedPlate.slice(-4),
    chassis_no: "********" + cleanedPlate.slice(-6),
    insurance_expiry: "Valid (System Verified)"
  };
};
