import grabDirNames from "../grab-dir-names";

type Params = {
    use_relay_server?: boolean;
    key_file?: string;
};

export default function grabSSHPrefix(params?: Params) {
    const { sshPrivateKeyFile, relayServerSshPrivateKeyFile } = grabDirNames();

    const finalKeyFile = params?.key_file
        ? params.key_file
        : params?.use_relay_server
        ? relayServerSshPrivateKeyFile
        : sshPrivateKeyFile;

    return `ssh -i ${finalKeyFile} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C -c aes128-ctr`;
}
