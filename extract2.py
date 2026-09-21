import re

content = ""
with open('/home/brk/.gemini/antigravity/brain/57cd5779-179a-4ffe-b78d-e4ad5ed45b92/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find the last occurrence of the page.tsx content that starts with "1: import React" and ends with "export default function page() {"
# Actually, let's just find the last TOOL_RESPONSE that viewed page.tsx
pattern = r'("output":\s*"Created At:.*?File Path: `file:///home/brk/Desktop/logs/job_portal_service_1/log-reader-app/app/page.tsx.*?The above content shows the entire, complete file contents of the requested file.\\n")'

matches = re.findall(pattern, content, re.DOTALL)
if matches:
    print(f"Found {len(matches)} matches for page.tsx")
    last_match = matches[-2] if len(matches) > 1 else matches[-1]
    
    # Write the raw json string to a file to be processed
    with open('raw_page.txt', 'w', encoding='utf-8') as f:
        f.write(last_match)
else:
    print("No matches found for page.tsx")

pattern2 = r'("output":\s*"Created At:.*?File Path: `file:///home/brk/Desktop/logs/job_portal_service_1/log-reader-app/hooks/useLogFile.ts.*?The above content shows the entire, complete file contents of the requested file.\\n")'

matches2 = re.findall(pattern2, content, re.DOTALL)
if matches2:
    print(f"Found {len(matches2)} matches for useLogFile.ts")
    last_match2 = matches2[-2] if len(matches2) > 1 else matches2[-1]
    
    with open('raw_useLogFile.txt', 'w', encoding='utf-8') as f:
        f.write(last_match2)
else:
    print("No matches found for useLogFile.ts")

