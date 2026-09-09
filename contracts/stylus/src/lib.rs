//! ValidationContract
//!
//! Verifies proof of task completion before AgentRelayEscrow releases payment.
//! This is written in Stylus rather than Solidity because signature recovery
//! is a repeated, compute-heavy operation, and Stylus runs it at a fraction
//! of the gas cost of an equivalent Solidity implementation. Everything else
//! in this project (identity, reputation, escrow state) stays in Solidity
//! because it is state-management logic, not compute-heavy, and Solidity
//! already handles that well.
//!
//! MVP scope: this checks an ECDSA signature over the expected result, not
//! a full Merkle proof or zk-proof scheme. The full ERC-8004 Validation
//! Registry leaves the verification method open by design, so a signature
//! check is a legitimate, scoped implementation of it, not a shortcut around it.
//!
//! Signature recovery uses the k256 crate directly rather than calling the
//! EVM's ecrecover precompile, since native recovery is the piece that
//! actually benefits from Stylus's performance advantage.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use stylus_sdk::{
    abi::Bytes,
    alloy_primitives::{Address, B256},
    prelude::*,
};

sol_storage! {
    #[entrypoint]
    pub struct ValidationContract {
        // The address expected to have signed a valid completion proof.
        // In a fuller version this would be looked up per-agent from the
        // IdentityRegistry rather than a single fixed trusted signer.
        address trusted_signer;
    }
}

// k256 pulls in getrandom transitively through its ecdsa feature, since
// that feature also covers SigningKey generation elsewhere in the crate.
// This contract only ever recovers a public key from an existing signature,
// a fully deterministic operation, and never generates keys or randomness.
// getrandom still refuses to compile for wasm32-unknown-unknown unless a
// backend is explicitly chosen, so this registers a stub that errors if
// ever called. It is safe here specifically because verify_proof's code
// path never reaches it. Do not reuse this stub in a contract that ever
// needs real randomness, since that would silently fail on-chain.
getrandom::register_custom_getrandom!(unreachable_getrandom);
fn unreachable_getrandom(_buf: &mut [u8]) -> Result<(), getrandom::Error> {
    Err(getrandom::Error::UNSUPPORTED)
}

#[public]
impl ValidationContract {
    /// One-time setup, run after deployment, since Stylus contracts do not
    /// support constructor arguments the same way Solidity does.
    pub fn initialize(&mut self, signer: Address) {
        self.trusted_signer.set(signer);
    }

    /// Verifies that `proof` is a valid ECDSA signature, from the trusted
    /// signer, over `expected_result`. Returns true if valid.
    ///
    /// # Arguments
    /// * `proof` - a 65-byte ECDSA signature (r, s, v) over `expected_result`.
    /// * `expected_result` - the data the signature must cover, for example
    ///   a hash of the API response the claimant agent produced.
    pub fn verify_proof(&self, proof: Bytes, expected_result: Bytes) -> bool {
        if proof.len() != 65 {
            return false;
        }

        let message_hash = stylus_sdk::crypto::keccak(&expected_result);
        let recovered = Self::recover_signer(message_hash.into(), &proof);

        match recovered {
            Some(addr) => addr == self.trusted_signer.get(),
            None => false,
        }
    }

    /// Read-only helper so a frontend or the requester can check the signer
    /// address without submitting a transaction.
    pub fn trusted_signer(&self) -> Address {
        self.trusted_signer.get()
    }
}

impl ValidationContract {
    /// Recovers the signer address from a 65-byte (r, s, v) signature over a
    /// 32-byte message hash. Split out as a plain function, not a public
    /// method, since it is an internal helper rather than part of the
    /// contract's external interface.
    ///
    /// This mirrors the pattern used by revm's own ecrecover precompile
    /// implementation (bluealloy/revm, crates/precompile/src/secp256k1.rs):
    /// parse the 64-byte signature, normalize s to its low-s form (flipping
    /// the recovery id if needed, since Ethereum signatures aren't always
    /// pre-normalized), recover the public key, then hash and truncate it
    /// to get the Ethereum-style address.
    fn recover_signer(message_hash: B256, signature: &[u8]) -> Option<Address> {
        if signature.len() != 65 {
            return None;
        }

        // Ethereum signatures encode v as 27/28; k256 expects a 0/1 recovery id.
        let mut recid_byte = signature[64];
        if recid_byte >= 27 {
            recid_byte -= 27;
        }

        let mut sig = k256::ecdsa::Signature::from_slice(&signature[..64]).ok()?;

        // Some signatures use the "high-s" form, which is valid ECDSA but
        // not canonical for Ethereum. Normalizing flips the recovery id.
        if let Some(normalized) = sig.normalize_s() {
            sig = normalized;
            recid_byte ^= 1;
        }

        let recovery_id = k256::ecdsa::RecoveryId::from_byte(recid_byte)?;
        let recovered_key =
            k256::ecdsa::VerifyingKey::recover_from_prehash(message_hash.as_slice(), &sig, recovery_id)
                .ok()?;

        // Ethereum addresses are the last 20 bytes of keccak256 of the
        // uncompressed public key, dropping the leading 0x04 prefix byte.
        let encoded_point = recovered_key.to_encoded_point(false);
        let hash = stylus_sdk::crypto::keccak(&encoded_point.as_bytes()[1..]);

        Some(Address::from_slice(&hash[12..]))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use k256::ecdsa::SigningKey;

    #[test]
    fn test_reproduces_real_onchain_failure() {
        // Uses the exact hash, signature, and signer address from the actual
        // failed cast call, to check whether recover_signer disagrees with
        // itself here too (a real logic bug) or only fails on-chain (an
        // ABI-encoding mismatch between cast's output and what the contract
        // receives, which would point at the call site, not this function).
        let message_hash_hex = "4a044ee95fdd975f54e2a6ee3754fd815e6aa3055f236d3a68ed3a8593aee62a";
        let signature_hex = "8ff6c935a4e7093d03ac1e73e94d59c44f0a527b557b04fd2df1df2ae510d6365f4183de77ae4c7d1c52c4a81ceba355b6cf4ed4fdd2c8839a05c04b3bd048401c";
        let expected_signer_hex = "D03CC1480d30310B6D3Fec569cb5BC0E662c2Bd0";

        let message_hash_bytes = hex_decode(message_hash_hex);
        let signature_bytes = hex_decode(signature_hex);
        let expected_signer_bytes = hex_decode(expected_signer_hex);

        assert_eq!(message_hash_bytes.len(), 32, "hash should be 32 bytes");
        assert_eq!(signature_bytes.len(), 65, "signature should be 65 bytes");
        assert_eq!(expected_signer_bytes.len(), 20, "address should be 20 bytes");

        let message_hash = B256::from_slice(&message_hash_bytes);
        let expected_signer = Address::from_slice(&expected_signer_bytes);

        let recovered = ValidationContract::recover_signer(message_hash, &signature_bytes);

        println!("recovered:       {:?}", recovered);
        println!("expected signer: {:?}", expected_signer);

        assert_eq!(recovered, Some(expected_signer));
    }

    /// Minimal hex decoder so this test has no extra dependency, just for
    /// turning the copy-pasted hex strings above into raw bytes.
    fn hex_decode(s: &str) -> alloc::vec::Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn test_rejects_short_proof() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let contract = ValidationContract::from(&vm);
        // A proof that isn't 65 bytes should always fail closed, not panic.
        assert_eq!(false, contract.verify_proof(Bytes::from(vec![1, 2, 3]), Bytes::from(vec![4, 5, 6])));
    }

    #[test]
    fn test_recover_matches_real_signature() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let _contract = ValidationContract::from(&vm);

        // Fixed 32-byte scalar, not randomly generated, so this test never
        // touches getrandom, which is intentionally stubbed out for the
        // on-chain build and would fail if called here.
        let secret_bytes = [0x11u8; 32];
        let signing_key = SigningKey::from_bytes((&secret_bytes).into()).expect("valid key");
        let verifying_key = *signing_key.verifying_key();

        let expected_result = b"test-task-completion-proof".to_vec();
        let message_hash = stylus_sdk::crypto::keccak(&expected_result);

        // Deterministic (RFC6979) signing, no randomness involved.
        let (signature, recovery_id): (k256::ecdsa::Signature, k256::ecdsa::RecoveryId) =
            signing_key
                .sign_prehash_recoverable(message_hash.as_slice())
                .expect("signing should succeed");

        let mut proof = signature.to_bytes().to_vec();
        proof.push(27 + recovery_id.to_byte());

        // Derive the expected address the same way recover_signer does,
        // so the test checks against ground truth, not our own function.
        let encoded_point = verifying_key.to_encoded_point(false);
        let expected_hash = stylus_sdk::crypto::keccak(&encoded_point.as_bytes()[1..]);
        let expected_address = Address::from_slice(&expected_hash[12..]);

        let recovered = ValidationContract::recover_signer(message_hash.into(), &proof);
        assert_eq!(recovered, Some(expected_address));
    }
}
