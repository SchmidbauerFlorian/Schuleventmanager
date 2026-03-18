import re

def can_plan(user):
    email = user.get("mail", "")
    # Muster: Ein Großbuchstabe, ein Kleinbuchstabe, gefolgt von der Domain
    pattern = r"^[a-z][a-z]@htlwy\.at$"
    
    if re.match(pattern, email) or email == "florian.schmidbauer@htlwy.at":
        return True
    return False