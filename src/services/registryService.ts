import { DetectionResult } from "./anprService";

export interface RegistryDetails {
  ownerName: string;
  registrationDate: string;
  fuelType: string;
  engineNumber: string;
  chassisNumber: string;
  vehicleModel: string;
  vehicleMake: string;
  status: 'Active' | 'Blacklisted' | 'Expired';
}

const mockRegistry: Record<string, RegistryDetails> = {
  "KA01HH1234": {
    ownerName: "Rahul Sharma",
    registrationDate: "2021-05-12",
    fuelType: "Petrol",
    engineNumber: "ENG987654321",
    chassisNumber: "CHAS123456789",
    vehicleModel: "City",
    vehicleMake: "Honda",
    status: 'Active'
  },
  "MH12AB1234": {
    ownerName: "Priya Patel",
    registrationDate: "2019-11-20",
    fuelType: "Diesel",
    engineNumber: "ENG123456789",
    chassisNumber: "CHAS987654321",
    vehicleModel: "Fortuner",
    vehicleMake: "Toyota",
    status: 'Blacklisted'
  },
  "DL3CAY9321": {
    ownerName: "Amit Singh",
    registrationDate: "2023-01-05",
    fuelType: "EV",
    engineNumber: "N/A",
    chassisNumber: "CHAS556677889",
    vehicleModel: "Nexon EV",
    vehicleMake: "Tata",
    status: 'Active'
  }
};

export const lookupRegistryDetails = async (plate: string): Promise<RegistryDetails | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const normalizedPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  if (mockRegistry[normalizedPlate]) {
    return mockRegistry[normalizedPlate];
  }

  // Generate deterministic mock data based on plate number if not in registry
  const hash = normalizedPlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const makes = ["Honda", "Toyota", "Tata", "Mahindra", "Hyundai", "Maruti Suzuki"];
  const models = ["City", "Fortuner", "Nexon", "Thar", "Creta", "Swift"];
  const owners = ["Suresh Kumar", "Anita Devi", "Vikram Rathore", "Sagarika Jena", "John Doe"];
  
  return {
    ownerName: owners[hash % owners.length],
    registrationDate: `201${hash % 9}-${String((hash % 12) + 1).padStart(2, '0')}-${String((hash % 28) + 1).padStart(2, '0')}`,
    fuelType: hash % 3 === 0 ? "EV" : (hash % 2 === 0 ? "Diesel" : "Petrol"),
    engineNumber: `ENG${hash}X${normalizedPlate.substring(0, 4)}`,
    chassisNumber: `CHAS${hash}Y${normalizedPlate.substring(4)}`,
    vehicleMake: makes[hash % makes.length],
    vehicleModel: models[hash % models.length],
    status: hash % 10 === 0 ? 'Blacklisted' : 'Active'
  };
};
