//! Run the production Windows transport against the runner browser on its own.
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};

mod windows;

pub struct Spawned {
    pub child: tokio::process::Child,
    pub reader: Box<dyn AsyncRead + Unpin + Send>,
    pub writer: Box<dyn AsyncWrite + Unpin + Send>,
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let chrome = ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"]
        .into_iter()
        .filter_map(std::env::var_os)
        .map(|root| PathBuf::from(root).join("Google/Chrome/Application/chrome.exe"))
        .find(|path| path.is_file())
        .expect("runner Chrome");
    let profile = std::env::temp_dir().join(format!("cadente-rust-pipe-{}", std::process::id()));
    let mut args = [
        "--headless=new",
        "--remote-debugging-pipe",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-breakpad",
        "--disable-features=Translate,MediaRouter,OptimizationHints",
        "--force-color-profile=srgb",
        "--mute-audio",
    ]
    .map(str::to_owned)
    .to_vec();
    args.push(format!("--user-data-dir={}", profile.display()));
    args.push("about:blank".into());
    let Spawned {
        mut child,
        reader,
        mut writer,
    } = windows::spawn(&chrome, &args).unwrap();
    let pid = child.id().unwrap();
    let reply = tokio::time::timeout(Duration::from_secs(15), async {
        eprintln!("writing request");
        writer
            .write_all(b"{\"id\":1,\"method\":\"Browser.getVersion\",\"params\":{}}\0")
            .await?;
        eprintln!("flushing request");
        writer.flush().await?;
        eprintln!("reading version");
        let mut bytes = Vec::new();
        BufReader::new(reader).read_until(0, &mut bytes).await?;
        Ok::<_, std::io::Error>(
            String::from_utf8_lossy(&bytes)
                .trim_end_matches('\0')
                .to_owned(),
        )
    })
    .await;
    eprintln!(
        "transport result: {reply:?}; child state: {:?}",
        child.try_wait()
    );
    windows::kill_tree(pid, true);
    let _ = child.wait().await;
    let _ = std::fs::remove_dir_all(&profile);
}
