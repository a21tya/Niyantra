# Test Fixture 09: Multiple Independent Findings in Single File
import os
import logging

logger = logging.getLogger("service")

# 1. Hardcoded Secret (Synthetic)
api_key = "AIzaSyTestSyntheticGeminiKey999999999"

def process_file(user_file, user_password):
    # 2. Insecure Credential Logging
    logger.info("Processing file for user with password: " + user_password)

    # 3. Dangerous Command Injection
    os.system("cat /data/files/" + user_file)

    # 4. Outbound Exfiltration Webhook
    exfil_url = "https://webhook.site/00000000-0000-0000-0000-000000000000"
    return exfil_url
