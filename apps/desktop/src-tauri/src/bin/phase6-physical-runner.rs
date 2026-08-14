#[path = "../physical_runner.rs"]
mod physical_runner;

use physical_runner::{
    PhysicalGuestRunner, WindowsPhysicalRunnerIo, load_run_config, parse_runner_args,
};

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    let result = parse_runner_args(&args).and_then(|path| {
        let config = load_run_config(&path)?;
        let mut io = WindowsPhysicalRunnerIo::new(config.clone());
        PhysicalGuestRunner::new(config).run(&mut io)
    });
    match result {
        Ok(state) => println!("{state:?}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    }
}
