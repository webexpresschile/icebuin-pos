import requests
import sys
import json
from datetime import datetime, timedelta

class FrozenPOSAPITester:
    def __init__(self, base_url="https://volumebuy-pos.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_product_id = None
        self.created_sale_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_register(self):
        """Test user registration"""
        test_user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@test.com",
            "name": "Test User",
            "password": "TestPass123!",
            "role": "seller"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login with existing user"""
        # First register a user
        test_user_data = {
            "email": f"login_test_{datetime.now().strftime('%H%M%S')}@test.com",
            "name": "Login Test User",
            "password": "TestPass123!",
            "role": "admin"
        }
        
        # Register first
        reg_success, reg_response = self.run_test(
            "Register for Login Test",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if not reg_success:
            return False
            
        # Now test login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            # Update token for subsequent tests
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_create_product(self):
        """Test product creation"""
        product_data = {
            "name": "Helado Premium Test",
            "sku": f"SKU-{datetime.now().strftime('%H%M%S')}",
            "barcode": f"123456789{datetime.now().strftime('%H%M%S')}",
            "regular_price": 2500.0,
            "category": "Helados",
            "stock": 100,
            "min_stock": 10,
            "volume_pricing_enabled": True,
            "volume_prices": [
                {
                    "quantity_min": 5,
                    "total_price": 10000.0,
                    "unit_price": 2000.0
                },
                {
                    "quantity_min": 10,
                    "total_price": 18000.0,
                    "unit_price": 1800.0
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Product with Volume Pricing",
            "POST",
            "products",
            200,
            data=product_data
        )
        
        if success and 'id' in response:
            self.created_product_id = response['id']
            print(f"   Product created with ID: {self.created_product_id}")
            return True
        return False

    def test_get_products(self):
        """Test getting all products"""
        success, response = self.run_test(
            "Get All Products",
            "GET",
            "products",
            200
        )
        
        if success:
            print(f"   Found {len(response)} products")
            return True
        return False

    def test_get_product_by_id(self):
        """Test getting product by ID"""
        if not self.created_product_id:
            print("❌ No product ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Product by ID",
            "GET",
            f"products/{self.created_product_id}",
            200
        )
        
        if success and response.get('id') == self.created_product_id:
            print(f"   Product retrieved: {response.get('name')}")
            return True
        return False

    def test_get_product_by_barcode(self):
        """Test getting product by barcode"""
        if not self.created_product_id:
            print("❌ No product available for barcode testing")
            return False
            
        # First get the product to know its barcode
        success, product = self.run_test(
            "Get Product for Barcode Test",
            "GET",
            f"products/{self.created_product_id}",
            200
        )
        
        if not success:
            return False
            
        barcode = product.get('barcode')
        if not barcode:
            print("❌ No barcode found in product")
            return False
            
        success, response = self.run_test(
            "Get Product by Barcode",
            "GET",
            f"products/barcode/{barcode}",
            200
        )
        
        if success and response.get('id') == self.created_product_id:
            print(f"   Product found by barcode: {response.get('name')}")
            return True
        return False

    def test_calculate_price(self):
        """Test price calculation with volume pricing"""
        if not self.created_product_id:
            print("❌ No product ID available for price calculation")
            return False
            
        # Test different quantities
        test_cases = [
            (1, "single unit"),
            (5, "volume tier 1"),
            (10, "volume tier 2"),
            (15, "mixed pricing")
        ]
        
        all_passed = True
        for quantity, description in test_cases:
            success, response = self.run_test(
                f"Calculate Price - {description} ({quantity} units)",
                "POST",
                f"products/calculate-price?product_id={self.created_product_id}&quantity={quantity}",
                200
            )
            
            if success:
                print(f"   Quantity {quantity}: Total ${response.get('total_price'):.2f}, "
                      f"Unit ${response.get('unit_price'):.2f}, "
                      f"Savings ${response.get('savings'):.2f}, "
                      f"Promotion: {response.get('promotion_applied')}")
            else:
                all_passed = False
                
        return all_passed

    def test_update_product(self):
        """Test product update"""
        if not self.created_product_id:
            print("❌ No product ID available for update testing")
            return False
            
        update_data = {
            "name": "Helado Premium Test - Updated",
            "regular_price": 2800.0,
            "stock": 150
        }
        
        success, response = self.run_test(
            "Update Product",
            "PUT",
            f"products/{self.created_product_id}",
            200,
            data=update_data
        )
        
        if success and response.get('name') == update_data['name']:
            print(f"   Product updated successfully")
            return True
        return False

    def test_create_sale(self):
        """Test creating a sale"""
        if not self.created_product_id:
            print("❌ No product ID available for sale testing")
            return False
            
        sale_data = {
            "items": [
                {
                    "product_id": self.created_product_id,
                    "product_name": "Helado Premium Test - Updated",
                    "quantity": 7,
                    "unit_price": 2000.0,
                    "total_price": 14000.0,
                    "regular_price": 2800.0,
                    "savings": 1600.0,
                    "promotion_applied": True
                }
            ],
            "total_amount": 14000.0,
            "total_savings": 1600.0
        }
        
        success, response = self.run_test(
            "Create Sale",
            "POST",
            "sales",
            200,
            data=sale_data
        )
        
        if success and 'id' in response:
            self.created_sale_id = response['id']
            print(f"   Sale created with ID: {self.created_sale_id}")
            return True
        return False

    def test_get_sales(self):
        """Test getting all sales"""
        success, response = self.run_test(
            "Get All Sales",
            "GET",
            "sales",
            200
        )
        
        if success:
            print(f"   Found {len(response)} sales")
            return True
        return False

    def test_get_sale_by_id(self):
        """Test getting sale by ID"""
        if not self.created_sale_id:
            print("❌ No sale ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Sale by ID",
            "GET",
            f"sales/{self.created_sale_id}",
            200
        )
        
        if success and response.get('id') == self.created_sale_id:
            print(f"   Sale retrieved: ${response.get('total_amount')}")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Statistics",
            "GET",
            "reports/dashboard",
            200
        )
        
        if success:
            stats = response
            print(f"   Today's sales: {stats.get('today_sales_count', 0)}")
            print(f"   Today's revenue: ${stats.get('today_revenue', 0)}")
            print(f"   Low stock products: {stats.get('low_stock_count', 0)}")
            print(f"   Total products: {stats.get('total_products', 0)}")
            return True
        return False

    def test_sales_report(self):
        """Test sales report with date range"""
        start_date = (datetime.now() - timedelta(days=7)).isoformat()
        end_date = datetime.now().isoformat()
        
        success, response = self.run_test(
            "Get Sales Report",
            "GET",
            "reports/sales",
            200,
            params={
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        if success:
            summary = response.get('summary', {})
            print(f"   Total sales: {summary.get('total_sales', 0)}")
            print(f"   Total revenue: ${summary.get('total_revenue', 0)}")
            print(f"   Total savings: ${summary.get('total_savings', 0)}")
            print(f"   Promotion sales: {summary.get('promotion_sales', 0)}")
            print(f"   Regular sales: {summary.get('regular_sales', 0)}")
            print(f"   Top products: {len(response.get('top_products', []))}")
            return True
        return False

    def test_delete_product(self):
        """Test product deletion"""
        if not self.created_product_id:
            print("❌ No product ID available for deletion testing")
            return False
            
        success, response = self.run_test(
            "Delete Product",
            "DELETE",
            f"products/{self.created_product_id}",
            200
        )
        
        if success:
            print(f"   Product deleted successfully")
            return True
        return False

def main():
    print("🚀 Starting FrozenPOS API Testing...")
    print("=" * 60)
    
    tester = FrozenPOSAPITester()
    
    # Test sequence
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Create Product", tester.test_create_product),
        ("Get All Products", tester.test_get_products),
        ("Get Product by ID", tester.test_get_product_by_id),
        ("Get Product by Barcode", tester.test_get_product_by_barcode),
        ("Calculate Pricing", tester.test_calculate_price),
        ("Update Product", tester.test_update_product),
        ("Create Sale", tester.test_create_sale),
        ("Get All Sales", tester.test_get_sales),
        ("Get Sale by ID", tester.test_get_sale_by_id),
        ("Dashboard Statistics", tester.test_dashboard_stats),
        ("Sales Report", tester.test_sales_report),
        ("Delete Product", tester.test_delete_product)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())