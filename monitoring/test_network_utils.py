import unittest
from network_utils import ping_host

class PingHostTests(unittest.TestCase):
    
    def test_ping_active_host(self):
        """
        Test pinging a known active public IP (Google DNS).
        This test expects the machine running it to have internet access.
        """
        # 8.8.8.8 is Google's primary public DNS server and is highly available.
        result = ping_host("8.8.8.8", timeout=2)
        self.assertTrue(result, "Expected pinging 8.8.8.8 to return True. Ensure you have an internet connection.")

    def test_ping_dead_host(self):
        """
        Test pinging a known dead/unroutable IP address.
        """
        # 192.0.2.1 is part of the TEST-NET-1 block, designated by RFC 5737 
        # for documentation and will not route on the public internet, ensuring a timeout.
        result = ping_host("192.0.2.1", timeout=1)
        self.assertFalse(result, "Expected pinging an unroutable IP (192.0.2.1) to return False.")

if __name__ == "__main__":
    unittest.main()
