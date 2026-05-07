import os
import httpx
import xml.etree.ElementTree as ET
from typing import Dict, List

class NamecheapClient:
    def __init__(self):
        self.api_user = os.getenv("NAMECHEAP_API_USER")
        self.api_key = os.getenv("NAMECHEAP_API_KEY")
        self.username = os.getenv("NAMECHEAP_USERNAME")
        self.client_ip = os.getenv("NAMECHEAP_CLIENT_IP")
        self.sandbox = os.getenv("ENV", "development")!= "production"
        self.base_url = "https://api.sandbox.namecheap.com/xml.response" if self.sandbox else "https://api.namecheap.com/xml.response"

        if not all([self.api_user, self.api_key, self.username, self.client_ip]):
            raise ValueError("Missing Namecheap env vars")

    def _base_params(self, command: str) -> Dict:
        return {
            "ApiUser": self.api_user,
            "ApiKey": self.api_key,
            "UserName": self.username,
            "ClientIp": self.client_ip,
            "Command": command,
        }

    def _parse_check_response(self, xml_text: str) -> List[Dict]:
        ns = {"nc": "http://api.namecheap.com/xml.response"}
        root = ET.fromstring(xml_text)
        results = []
        status = root.find(".//nc:ApiResponse", ns).get("Status")
        if status!= "OK":
            errors = [e.text for e in root.findall(".//nc:Errors/nc:Error", ns)]
            raise Exception(f"Namecheap API Error: {', '.join(errors)}")
        for domain_result in root.findall(".//nc:CommandResponse/nc:DomainCheckResult", ns):
            results.append({
                "domain": domain_result.get("Domain"),
                "available": domain_result.get("Available") == "true",
                "is_premium": domain_result.get("IsPremiumName") == "true",
                "premium_price": float(domain_result.get("PremiumRegistrationPrice", 0)),
            })
        return results

    async def check_domains(self, domains: List[str]) -> List[Dict]:
        params = self._base_params("namecheap.domains.check")
        params["DomainList"] = ",".join(domains)
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(self.base_url, params=params)
            r.raise_for_status()
            return self._parse_check_response(r.text)

    async def get_domain_price(self, tld: str) -> Dict:
        params = self._base_params("namecheap.users.getPricing")
        params["ProductType"] = "DOMAIN"
        params["ProductCategory"] = "REGISTER"
        params["ProductName"] = tld
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(self.base_url, params=params)
            root = ET.fromstring(r.text)
            ns = {"nc": "http://api.namecheap.com/xml.response"}
            price_elem = root.find(".//nc:Product[@Name='" + tld + "']/nc:Price", ns)
            if price_elem is not None:
                return {"tld": tld, "register_usd": float(price_elem.get("Price", 0))}
        return {"tld": tld, "register_usd": 12.0}