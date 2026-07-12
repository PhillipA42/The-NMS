import platform
import subprocess
import logging

logger = logging.getLogger(__name__)

def ping_host(ip_address: str, timeout: int = 2) -> bool:
    """
    Executes an ICMP ping against a target host using the native OS ping command.
    
    Args:
        ip_address (str): The IP address (IPv4 or IPv6) to ping.
        timeout (int): The timeout window in seconds. Defaults to 2.
        
    Returns:
        bool: True if the host responds, False if it drops packets or times out.
    """
    try:
        current_os = platform.system().lower()
        
        if current_os == "windows":
            # Windows: -n (count), -w (timeout in milliseconds)
            args = ["ping", "-n", "1", "-w", str(timeout * 1000), ip_address]
        else:
            # Unix/Linux/Mac: -c (count), -W (timeout in seconds)
            args = ["ping", "-c", "1", "-W", str(timeout), ip_address]
            
        result = subprocess.run(args, capture_output=True, text=True)
        output = result.stdout.lower()
        
        # Native ping commands can sometimes return exit code 0 even if the 
        # destination host is unreachable. Checking for 'ttl=' is a reliable 
        # cross-platform way to confirm a successful ICMP echo reply.
        if "ttl=" in output:
            return True
            
        return False
        
    except Exception as e:
        logger.error(f"Error executing ping against {ip_address}: {e}")
        return False
