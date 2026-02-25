#!/usr/bin/env python3
"""Fix remaining inline strings by line number."""

FILE = "src/services/core/botLogicService.ts"

with open(FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

before_count = sum(1 for l in lines if 'language === "en"' in l)
count = 0

# Fix vehicle_confirm dup — find line with 've identified and language
for i in range(len(lines)):
    if 'language === "en"' in lines[i] and i+2 < len(lines) and 've identified your vehicle' in lines[i+1]:
        old_block = ''.join(lines[i:i+3])
        new_line = "            replyText = tWith('vehicle_confirm', language, { summary });\n"
        lines[i] = new_line
        lines[i+1] = "            nextStatus = \"confirm_vehicle\";\n"
        lines[i+2] = ""
        count += 1
        print(f"OK [{count}]: vehicle_confirm dup at L{i+1}")
        break

# Fix vehicle_correction — find line with sorry
for i in range(len(lines)):
    if 'language === "en"' in lines[i] and i+2 < len(lines) and 'sorry' in lines[i+1]:
        lines[i] = "            replyText = t('vehicle_correction', language);\n"
        lines[i+1] = ""
        lines[i+2] = ""
        count += 1
        print(f"OK [{count}]: vehicle_correction at L{i+1}")
        break

# Fix pickup_location — find reserved the part
for i in range(len(lines)):
    if 'language === "en"' in lines[i] and i+2 < len(lines) and 'reserved the part' in lines[i+1]:
        lines[i] = "              replyText = tWith('pickup_location', language, { location: dealerLoc });\n"
        lines[i+1] = ""
        lines[i+2] = ""
        count += 1
        print(f"OK [{count}]: pickup_location at L{i+1}")
        break

# Fix follow_up_part — find using your
for i in range(len(lines)):
    if 'language === "en"' in lines[i] and i+2 < len(lines) and 'using your' in lines[i+1]:
        lines[i] = "              replyText = tWith('follow_up_part', language, { make: orderData?.vehicle?.make || '', model: orderData?.vehicle?.model || '' });\n"
        lines[i+1] = ""
        lines[i+2] = ""
        count += 1
        print(f"OK [{count}]: follow_up_part at L{i+1}")
        break

# Write out, filtering blank lines
output = [l for l in lines if l != ""]
with open(FILE, "w", encoding="utf-8") as f:
    f.writelines(output)

after_count = sum(1 for l in output if 'language === "en"' in l)
print(f"\nBefore: {before_count}, After: {after_count}, Fixed: {count}")
