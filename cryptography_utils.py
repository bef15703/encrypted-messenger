import os
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import serialization

# Generates ECDH key pair for client session
def generate_ecdh_key_pair():
    private_key = ec.generate_private_key(ec.SECP384R1())
    public_key = private_key.public_key()
    return private_key, public_key

# Serializes public key to bytes
def serialize_public_key(public_key):
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

# Deserializes public key from bytes
def deserialize_public_key(public_key_bytes):
    return serialization.load_pem_public_key(public_key_bytes)

# Deruves shared AES key from personal private key and peer's shared public key
def derive_shared_aes_key(self_private_key, peer_public_key):
    shared_secret = self_private_key.exchange(ec.ECDH(), peer_public_key)

    # Produces 256-bit AES key using HKDF
    derived_key= HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"messenger key exchange"
    ).derive(shared_secret)

    return derived_key

# Encrypts message using derived AESGCM key
def encrypt_message(aes_key: bytes, plaintext: str) -> bytes:
    aesgcm = AESGCM(aes_key)

    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), associated_data=None)

    return nonce + ciphertext

# Decrypts message usinf derived AESGCM key
def decrypt_message(aes_key: bytes, payload: bytes) -> str:
    nonce = payload[:12]
    ciphertext = payload[12:]
    aesgcm = AESGCM(aes_key)
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    return plaintext_bytes.decode('utf-8')