// Configuración de empresas disponibles en el sistema
import { Company } from '../services/companyService';

interface CompanyConfig {
  // Lista de empresas disponibles
  availableCompanies: Company[];
}

export const companyConfig: CompanyConfig = {
  availableCompanies: [
    {
      id: "innova",
      name: "Innova & AI Group CR S.R.L.",
      idNumber: "3102928079",
      envFile: "companies/innova.env",
      logo: "/assets/logos/innova-logo.png",
      isDefault: true
    },
    {
      id: "empresa2",
      name: "Empresa 2 S.A.",
      idNumber: "3101123456",
      envFile: "companies/empresa2.env",
      logo: "/assets/logos/empresa2-logo.png"
    },
    {
      id: "empresa3",
      name: "Empresa 3 Limitada",
      idNumber: "3102789012",
      envFile: "companies/empresa3.env",
      logo: "/assets/logos/empresa3-logo.png"
    }
  ]
};
